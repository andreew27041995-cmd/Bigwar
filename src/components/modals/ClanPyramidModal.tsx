import React, { useState, useEffect, useRef } from 'react';
import { HeroState, PlayerPosition, PyramidCell, LootHistoryEntry } from '../../types/game';
import {
  getPlayerClan,
  ensureClanExistsFromHero,
  getClanPyramidState,
  saveClanPyramidState,
  addClanInfluence,
  addClanExp,
  getClanPyramidBuffs,
  generateClanPyramidGrid,
  getClanNextLevelExp,
  creditClanTreasuryFromClanPyramid,
  getAllClans,
  MAX_CLAN_LEVEL
} from '../../utils/clanStorage';
import {
  getHeroTotalDamage,
  getHeroTotalMaxHp,
  getHeroTotalDodge,
  EXP_TABLE,
  MAX_LEVEL
} from '../../utils/gameData';
import { RealtimePlayer } from '../../utils/supabase';
import CharacterAvatar from '../CharacterAvatar';
import { ELIXIR_EN_IMG, ELIXIR_HP_IMG, ELIXIR_EXP_IMG } from '../../utils/elixirAssets';
import { ItemIcon } from '../ItemIcon';

export interface ClanPyramidFighter {
  nick: string;
  lvl: number;
  hp: number;
  maxHp: number;
  avatar: string;
  clanId: string;
  clanTag: string;
  clanName: string;
  row: number;
  col: number;
  isOnline: boolean;
}

interface ClanPyramidModalProps {
  currentUser: string | null;
  hero: HeroState;
  isAdmin?: boolean;
  onClose: () => void;
  onOpenClansTab: () => void;
  onUpdateHero: (updated: Partial<HeroState>) => void;
  onUsePotion?: (type: 'hp' | 'en' | 'exp') => void;
  onOpenAdminClanPyramid?: () => void;
  showToast: (text: string) => void;
  realtimePlayers?: RealtimePlayer[];
  onInspectPlayer?: (nick: string) => void;
  onAddLootHistory?: (entry: Omit<LootHistoryEntry, 'id' | 'timestamp' | 'timeStr'>) => void;
}

export const ClanPyramidModal: React.FC<ClanPyramidModalProps> = ({
  currentUser,
  hero,
  isAdmin = false,
  onClose,
  onOpenClansTab,
  onUpdateHero,
  onUsePotion,
  onOpenAdminClanPyramid,
  showToast,
  realtimePlayers = [],
  onInspectPlayer,
  onAddLootHistory
}) => {
  const myNick = currentUser || hero.nick || 'Игрок';
  const [pyramidState, setPyramidState] = useState(() => getClanPyramidState());
  const [viewMode, setViewMode] = useState<'map' | 'leaderboard'>('map');
  const [playerPos, setPlayerPos] = useState<PlayerPosition>({ row: 9, col: 1 });
  const [combatLog, setCombatLog] = useState<{ id: string; text: string; time: string }[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const playerCellRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (viewMode === 'map' && playerCellRef.current) {
      playerCellRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [playerPos.row, playerPos.col, viewMode]);

  const playerClan =
    getPlayerClan(myNick, hero.clanId) ||
    (hero.clanId ? ensureClanExistsFromHero(hero, myNick) : undefined);

  // Initialize other clan fighters stationed on the 10x10 map for competition
  const [clanFighters, setClanFighters] = useState<ClanPyramidFighter[]>(() => {
    const list: ClanPyramidFighter[] = [];
    const allClans = getAllClans();
    const cleanMyNick = myNick.trim().toLowerCase();

    // 1. Gather players from other clans or realtime players
    const fighterCandidateNicks = new Set<string>();

    allClans.forEach((clan, clanIdx) => {
      (clan.members || []).forEach((mem, memIdx) => {
        const mNick = mem.nick.trim();
        if (mNick.toLowerCase() === cleanMyNick) return;
        if (fighterCandidateNicks.has(mNick.toLowerCase())) return;
        fighterCandidateNicks.add(mNick.toLowerCase());

        // Deterministic placement on the 10x10 grid avoiding entrance [9,0], [9,1] and throne [0,9]
        let r = 1 + ((clanIdx * 3 + memIdx * 2 + 1) % 8);
        let c = 1 + ((clanIdx * 2 + memIdx * 3 + 2) % 8);
        if (r === 9 && (c === 0 || c === 1)) r = 8;
        if (r === 0 && c === 9) c = 8;

        const rt = realtimePlayers.find((p) => p.nick.toLowerCase() === mNick.toLowerCase());
        const fLvl = rt?.lvl || mem.lvl || 2;
        const fMaxHp = rt?.maxHp || (100 + (fLvl - 1) * 12);
        const fHp = rt?.hp ?? fMaxHp;

        list.push({
          nick: mNick,
          lvl: fLvl,
          hp: fHp,
          maxHp: fMaxHp,
          avatar: rt?.avatar || (mem.role === 'leader' ? '🤴' : '🥷'),
          clanId: clan.id,
          clanTag: clan.tag,
          clanName: clan.name,
          row: r,
          col: c,
          isOnline: rt?.isOnline ?? true
        });
      });
    });

    return list.slice(0, 12); // Up to 12 rival fighters across the map
  });

  const config = pyramidState.config!;
  const clanBuffs = getClanPyramidBuffs(playerClan?.id);
  const heroTotalDmg = getHeroTotalDamage(hero);
  const heroMaxHp = getHeroTotalMaxHp(hero);
  const heroDodge = getHeroTotalDodge(hero);

  // Sync timer and auto-respawn check every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      const freshState = getClanPyramidState();
      const cfg = freshState.config!;
      const elapsedSec = Math.floor((now - (freshState.lastGridRespawnAt || 0)) / 1000);
      if (elapsedSec >= (cfg.respawnIntervalSec || 60)) {
        const nextSeed = Math.floor(now / 1000);
        const nextGrid = generateClanPyramidGrid(cfg, nextSeed);
        const updatedState = {
          ...freshState,
          gridCells: nextGrid,
          gridSeed: nextSeed,
          lastGridRespawnAt: now
        };
        saveClanPyramidState(updatedState);
        setPyramidState(updatedState);
      } else {
        setPyramidState(freshState);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ensure grid exists on mount
  useEffect(() => {
    const st = getClanPyramidState();
    if (!Array.isArray(st.gridCells) || st.gridCells.length !== 10) {
      const seed = Math.floor(Date.now() / 1000);
      const nextGrid = generateClanPyramidGrid(st.config!, seed);
      const next = {
        ...st,
        gridCells: nextGrid,
        gridSeed: seed,
        lastGridRespawnAt: Date.now()
      };
      saveClanPyramidState(next);
      setPyramidState(next);
    }
  }, []);

  const handleLocalUsePotion = (type: 'hp' | 'en' | 'exp') => {
    if (onUsePotion) {
      onUsePotion(type);
      return;
    }
    if (type === 'hp') {
      if (hero.hpPotions <= 0 || hero.hp >= heroMaxHp) return;
      onUpdateHero({
        hpPotions: Math.max(0, hero.hpPotions - 1),
        hp: Math.min(heroMaxHp, hero.hp + 50)
      });
      showToast('❤️ Выпито Зелье Жизни (+50 HP)');
    } else if (type === 'en') {
      if (hero.enPotions <= 0 || hero.energy >= hero.maxEnergy) return;
      onUpdateHero({
        enPotions: Math.max(0, hero.enPotions - 1),
        energy: Math.min(hero.maxEnergy, hero.energy + 20)
      });
      showToast('⚡ Выпито Зелье Энергии (+20 EN)');
    } else if (type === 'exp') {
      const count = Number(hero.expPotions || 0);
      if (count <= 0) return;
      const baseUntil = hero.expElixirUntil && hero.expElixirUntil > Date.now() ? hero.expElixirUntil : Date.now();
      onUpdateHero({
        expPotions: Math.max(0, count - 1),
        expElixirUntil: baseUntil + 30 * 60 * 1000
      });
      showToast('✨ Выпит Эликсир Опыта (+25% к опыту на 30 мин)');
    }
  };

  // If player is not in a clan -> show locked gate
  if (!playerClan) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md">
        <div className="relative flex w-full max-w-md flex-col items-center rounded-2xl border-2 border-amber-600/80 bg-gradient-to-b from-slate-950 via-amber-950/40 to-slate-950 p-6 text-center text-white shadow-[0_0_30px_rgba(245,158,11,0.25)]">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-amber-500 bg-slate-950 text-3xl shadow-lg">
            🔒
          </div>
          <h2 className="text-base font-black uppercase tracking-wider text-amber-300">
            Клановая Пирамида: Доступ Закрыт
          </h2>
          <div className="mt-2 text-xs text-slate-300 space-y-1.5 leading-relaxed">
            <p>Вы не состоите ни в одном клане.</p>
            <p className="text-[11px] text-amber-200/90 font-medium">
              Отдельная 10×10 Клановая Пирамида доступна только участникам кланов!
            </p>
            <p className="text-[10px] text-slate-400">
              Вступите в существующий клан или создайте свой за 1000 💎, чтобы сражаться в Клановой Пирамиде, прокачивать уровень клана (до 20 ур.) и захватывать контроль над Пирамидой!
            </p>
          </div>

          <div className="mt-5 flex items-center gap-2 w-full">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              Закрыть
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenClansTab();
              }}
              className="flex-[2] rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-600 to-yellow-600 py-2 text-xs font-black uppercase text-slate-950 shadow-lg hover:brightness-110 active:scale-95"
            >
              🛡️ Перейти к кланам
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check minimum clan level requirement if configured by Admin
  if ((config.minClanLevel || 1) > (playerClan.level || 1)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md">
        <div className="relative flex w-full max-w-md flex-col items-center rounded-2xl border-2 border-red-600/80 bg-slate-950 p-6 text-center text-white shadow-2xl">
          <div className="mb-3 text-4xl">🏛️</div>
          <h2 className="text-base font-black uppercase text-red-400">
            Требуется {config.minClanLevel} уровень клана!
          </h2>
          <p className="mt-2 text-xs text-slate-300">
            Ваш клан «{playerClan.name}» сейчас {playerClan.level} уровня. Для входа в Клановую Пирамиду требуется минимум {config.minClanLevel} уровень клана.
          </p>
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-slate-800 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  const gridCells: PyramidCell[][] =
    Array.isArray(pyramidState.gridCells) && pyramidState.gridCells.length === 10
      ? pyramidState.gridCells
      : generateClanPyramidGrid(config, pyramidState.gridSeed || 1);

  const respawnIntervalSec = config.respawnIntervalSec || 60;
  const elapsedSec = Math.floor((nowMs - (pyramidState.lastGridRespawnAt || 0)) / 1000);
  const respawnTimeLeft = Math.max(0, respawnIntervalSec - elapsedSec);
  const energyPerMove = Math.max(1, config.energyPerMove || 2);

  const hpPercent = Math.max(0, Math.min(100, (hero.hp / Math.max(1, heroMaxHp)) * 100));
  const enPercent = Math.max(0, Math.min(100, (hero.energy / Math.max(1, hero.maxEnergy)) * 100));
  const nextExp = hero.level >= MAX_LEVEL ? 0 : EXP_TABLE[hero.level] || 1000;
  const expPercent = nextExp > 0 ? Math.min(100, (hero.exp / nextExp) * 100) : 100;

  const clanNextExp = getClanNextLevelExp(playerClan.level);
  const clanExpPct =
    clanNextExp > 0 ? Math.min(100, Math.round(((playerClan.exp || 0) / clanNextExp) * 100)) : 100;

  const addLog = (text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCombatLog((prev) => [{ id: `${Date.now()}_${Math.random()}`, text, time }, ...prev].slice(0, 25));
  };

  // Apply level-up check for Hero when gaining EXP inside Clan Pyramid
  const applyHeroExpAndRewards = (
    baseHero: HeroState,
    changes: {
      hp: number;
      energy: number;
      goldDelta: number;
      crystalsDelta: number;
      expDelta: number;
      mobKilled?: boolean;
    }
  ): Partial<HeroState> => {
    let nextLvl = baseHero.level || 1;
    let nextExp = (baseHero.exp || 0) + changes.expDelta;
    let nextStatPoints = baseHero.statPoints || 0;
    let nextMaxHp = heroMaxHp;
    let nextHp = Math.min(nextMaxHp, Math.max(0, changes.hp));
    let nextMaxEnergy = baseHero.maxEnergy || 100;

    while (nextLvl < MAX_LEVEL && nextExp >= (EXP_TABLE[nextLvl] || 999999)) {
      nextExp -= EXP_TABLE[nextLvl];
      nextLvl += 1;
      nextStatPoints += 1;
      nextMaxHp += 50;
      nextHp = nextMaxHp;
      nextMaxEnergy += 5;
      showToast(`🎉 ПОЗДРАВЛЯЕМ! Вы достигли ${nextLvl} уровня!`);
    }

    const nextGold = Math.max(0, (baseHero.gold || 0) + changes.goldDelta);
    const nextCrystals = Math.max(0, (baseHero.crystals || 0) + changes.crystalsDelta);

    return {
      level: nextLvl,
      lvl: nextLvl,
      exp: nextExp,
      statPoints: nextStatPoints,
      maxHp: nextMaxHp,
      hp: nextHp,
      maxEnergy: nextMaxEnergy,
      energy: changes.energy,
      gold: nextGold,
      crystals: nextCrystals,
      totalGoldCollected: Math.max(baseHero.totalGoldCollected || baseHero.gold || 0, nextGold),
      mobsKilled: (baseHero.mobsKilled || 0) + (changes.mobKilled ? 1 : 0)
    };
  };

  const handleCellClick = (r: number, c: number) => {
    const isAdjacent = Math.abs(r - playerPos.row) <= 1 && Math.abs(c - playerPos.col) <= 1;
    const isSameCell = r === playerPos.row && c === playerPos.col;
    if (!isAdjacent && !isSameCell) return;

    // Exit cell at (9, 0)
    if (r === 9 && c === 0) {
      onClose();
      return;
    }

    // 0. Clan PvP check: Is there another clan warrior on this cell?
    const targetFighter = !isSameCell
      ? clanFighters.find((f) => f.row === r && f.col === c && f.hp > 0)
      : undefined;

    if (targetFighter) {
      // 🛡️ FRIENDLY FIRE PROTECTION: Players of the same clan cannot attack or kill each other!
      if (playerClan && targetFighter.clanId === playerClan.id) {
        showToast(
          `🛡️ Это ваш соклановец [${targetFighter.clanTag || playerClan.tag}] ${targetFighter.nick}! Убивать игроков своего клана нельзя.`
        );
        if (onInspectPlayer) {
          onInspectPlayer(targetFighter.nick);
        }
        return;
      }

      // ⚔️ RIVAL CLAN PVP COMBAT: Attack enemy clan fighter!
      if (hero.energy < energyPerMove) {
        showToast(`⚡ Недостаточно энергии для удара! Нужно ${energyPerMove}⚡.`);
        return;
      }
      if (hero.hp <= 0) {
        showToast('❤️ Вы повержены! Выпейте эликсир здоровья.');
        return;
      }

      const isCrit = Math.random() < 0.22;
      const dmgMult = (isCrit ? 1.5 : 1) * (1 + clanBuffs.dmgBonusPct / 100);
      const dmgDealt = Math.max(1, Math.round(heroTotalDmg * dmgMult));
      const nextEnemyHp = Math.max(0, targetFighter.hp - dmgDealt);
      const nextEnergy = Math.max(0, hero.energy - energyPerMove);

      if (nextEnemyHp <= 0) {
        // Enemy clan member defeated!
        const pvpGold = Math.round(120 + Math.random() * 80);
        const pvpCrystals = Math.random() < 0.4 ? 1 : 0;
        const pvpExp = 80 + targetFighter.lvl * 8;
        const pvpInf = 35;
        const pvpClanExp = 45;

        // Add Clan Influence & Clan EXP
        addClanInfluence(playerClan.id, pvpInf, myNick);
        const clanExpRes = addClanExp(playerClan.id, pvpClanExp, myNick);

        // Credit Clan Treasury ONLY from Clan Pyramid!
        const treasuryRes = creditClanTreasuryFromClanPyramid(
          playerClan.id,
          myNick,
          pvpGold,
          pvpCrystals,
          `PvP победа над [${targetFighter.clanTag}] ${targetFighter.nick}`
        );

        // Remove defeated rival fighter from map and move player into cell
        setClanFighters((prev) => prev.filter((f) => f.nick !== targetFighter.nick));
        setPlayerPos({ row: r, col: c });

        const heroPatch = applyHeroExpAndRewards(hero, {
          hp: hero.hp,
          energy: nextEnergy,
          goldDelta: pvpGold,
          crystalsDelta: pvpCrystals,
          expDelta: pvpExp
        });
        heroPatch.pvpKills = (hero.pvpKills || 0) + 1;
        onUpdateHero(heroPatch);

        let treasuryNote = '';
        if (treasuryRes.addedGold > 0 || treasuryRes.addedCrystals > 0) {
          treasuryNote = ` | В казну клана: +${treasuryRes.addedGold}🪙${treasuryRes.addedCrystals > 0 ? `, +${treasuryRes.addedCrystals}💎` : ''}`;
        }

        const winMsg = `⚔️ ВЫ ПОБЕДИЛИ В КЛАНОВОМ PVP! [${targetFighter.clanTag}] ${targetFighter.nick} повержен! +${pvpGold}🪙${
          pvpCrystals > 0 ? `, +${pvpCrystals}💎` : ''
        }, +${pvpExp} EXP, +${pvpInf}⭐ влияния клана${treasuryNote}!`;
        addLog(winMsg);
        showToast(
          `⚔️ Победа над вражеским бойцом [${targetFighter.clanTag}] ${targetFighter.nick}! +${pvpInf}⭐ влияния!`
        );
      } else {
        // Rival fighter counterattacks!
        const enemyDmg = Math.max(12, Math.round((targetFighter.lvl * 9 + 20) * (1 - heroDodge / 200)));
        const dodged = Math.random() * 100 < heroDodge;
        let nextHeroHp = hero.hp;

        if (!dodged) {
          nextHeroHp = Math.max(0, hero.hp - enemyDmg);
        }

        setClanFighters((prev) =>
          prev.map((f) => (f.nick === targetFighter.nick ? { ...f, hp: nextEnemyHp } : f))
        );

        if (nextHeroHp <= 0) {
          // Player died in Clan PvP -> refresh Clan Pyramid map and eject to main City screen!
          const nextSeed = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000) + 1;
          const freshState = getClanPyramidState();
          const refreshedGrid = generateClanPyramidGrid(config, nextSeed);
          const refreshedState = {
            ...freshState,
            gridCells: refreshedGrid,
            gridSeed: nextSeed,
            lastGridRespawnAt: Date.now()
          };
          saveClanPyramidState(refreshedState);
          setPyramidState(refreshedState);
          setPlayerPos({ row: 9, col: 1 });

          onUpdateHero({
            hp: 0,
            energy: 0,
            deaths: (hero.deaths || 0) + 1
          });
          showToast(
            `☠️ Вы пали в клановом PvP от удара [${targetFighter.clanTag}] ${targetFighter.nick}! Вы выброшены в Город, а Клановая Пирамида обновлена.`
          );
          onClose();
        } else {
          onUpdateHero({
            hp: nextHeroHp,
            energy: nextEnergy
          });
          addLog(
            `⚔️ PvP удар по [${targetFighter.clanTag}] ${targetFighter.nick}: -${dmgDealt} HP${
              isCrit ? ' (КРИТ!)' : ''
            } [${nextEnemyHp}/${targetFighter.maxHp}]. ${
              dodged ? '💨 Вы уклонились!' : `💥 Контрудар: -${enemyDmg} HP`
            }`
          );
        }
      }
      return;
    }

    const cell = gridCells[r]?.[c];
    if (!cell) return;

    // 1. Throne Altar at (0, 9) (`nextTier` / `portal`)
    if (cell.type === 'nextTier' || cell.type === 'portal') {
      // Check if boss at (0,0) is still alive
      const bossCell = gridCells[0]?.[0];
      if (bossCell && bossCell.type === 'mob' && (bossCell.mobHp || 0) > 0) {
        showToast(`⚠️ Сначала повергните Верховного Босса «${bossCell.mobName}» на вершине [0,0]!`);
        return;
      }

      if (hero.energy < 1) {
        showToast('⚡ Недостаточно энергии для шага! Выпейте эликсир энергии.');
        return;
      }

      const bonusInf = 100;
      const bonusClanExp = 120;
      addClanInfluence(playerClan.id, bonusInf, myNick);
      const expRes = addClanExp(playerClan.id, bonusClanExp, myNick);

      // Credit Clan Treasury from Throne Altar
      const treasuryRes = creditClanTreasuryFromClanPyramid(
        playerClan.id,
        myNick,
        150,
        3,
        'захват Алтаря Трона Клановой Пирамиды'
      );

      // Regenerate fresh grid after capturing Throne Altar
      const nextSeed = Math.floor(Date.now() / 1000) + 7;
      const freshState = getClanPyramidState();
      const nextGrid = generateClanPyramidGrid(config, nextSeed);
      const updatedState = {
        ...freshState,
        gridCells: nextGrid,
        gridSeed: nextSeed,
        lastGridRespawnAt: Date.now()
      };
      saveClanPyramidState(updatedState);
      setPyramidState(updatedState);
      setPlayerPos({ row: 9, col: 1 });

      onUpdateHero({
        energy: Math.max(0, hero.energy - 1)
      });

      let treasuryNote = '';
      if (treasuryRes.addedGold > 0 || treasuryRes.addedCrystals > 0) {
        treasuryNote = ` | В казну клана: +${treasuryRes.addedGold}🪙${treasuryRes.addedCrystals > 0 ? `, +${treasuryRes.addedCrystals}💎` : ''}`;
      }

      const msg = `👑 Вы активировали Алтарь Трона Клановой Пирамиды! Клан «${playerClan.name}» получил +${bonusInf} ⭐ влияния и +${bonusClanExp} опыта клана${
        expRes.leveledUp ? ` (УРОВЕНЬ КЛАНА ПОВЫШЕН ДО ${expRes.newLevel}!)` : ''
      }${treasuryNote}!`;
      addLog(msg);
      showToast(msg);
      return;
    }

    // 2. Monster / Boss combat on cell
    if (cell.type === 'mob' && (cell.mobHp || 0) > 0) {
      if (hero.energy < energyPerMove) {
        showToast(`⚡ Недостаточно энергии для удара! Нужно ${energyPerMove}⚡.`);
        return;
      }
      if (hero.hp <= 0) {
        showToast('❤️ Вы повержены! Выпейте эликсир здоровья.');
        return;
      }

      const isCrit = Math.random() < 0.2;
      const dmgMult = (isCrit ? 1.5 : 1) * (1 + clanBuffs.dmgBonusPct / 100);
      const dmgDealt = Math.max(1, Math.round(heroTotalDmg * dmgMult));
      const curMobHp = Number(cell.mobHp || cell.mobMaxHp || 100);
      const nextMobHp = Math.max(0, curMobHp - dmgDealt);
      const nextEnergy = Math.max(0, hero.energy - energyPerMove);

      if (nextMobHp <= 0) {
        // Monster defeated!
        const isExpElixirActive = Boolean(hero.expElixirUntil && hero.expElixirUntil > Date.now());
        const isVipActive = Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now());

        const rawGold = Number(cell.mobGoldReward ?? 50);
        const rawCrystals = Number(cell.mobCrystalReward ?? 0);
        const rawExp = Number(cell.mobExpReward ?? 25);
        const rawClanExp = Number(cell.mobClanExpReward ?? 35);
        const rawInfluence = Number(cell.mobInfluenceReward ?? 15);

        const finalGold = Math.round(rawGold * (1 + clanBuffs.goldBonusPct / 100));
        let finalExp = Math.round(rawExp * (1 + clanBuffs.expBonusPct / 100));
        if (isExpElixirActive) finalExp = Math.round(finalExp * 1.25);
        if (isVipActive) finalExp = finalExp * 2;

        // Add Clan Influence & Clan EXP
        addClanInfluence(playerClan.id, rawInfluence, myNick);
        const clanExpRes = addClanExp(playerClan.id, rawClanExp, myNick);

        // Credit Clan Treasury ONLY from Clan Pyramid!
        const treasuryRes = creditClanTreasuryFromClanPyramid(
          playerClan.id,
          myNick,
          finalGold,
          rawCrystals,
          `победа над ${cell.mobName}`
        );

        // Update cell to empty and move player onto it
        const nextGrid = gridCells.map((rowArr, rIdx) =>
          rowArr.map((cCell, cIdx) => {
            if (rIdx === r && cIdx === c) {
              return { type: 'empty' as const };
            }
            return cCell;
          })
        );

        const freshState = getClanPyramidState();
        const updatedState = {
          ...freshState,
          gridCells: nextGrid
        };
        saveClanPyramidState(updatedState);
        setPyramidState(updatedState);
        setPlayerPos({ row: r, col: c });

        const heroPatch = applyHeroExpAndRewards(hero, {
          hp: hero.hp,
          energy: nextEnergy,
          goldDelta: finalGold,
          crystalsDelta: rawCrystals,
          expDelta: finalExp,
          mobKilled: true
        });
        onUpdateHero(heroPatch);
        if (onAddLootHistory) {
          onAddLootHistory({
            category: 'monster',
            title: cell.mobName || 'Страж Клановой Пирамиды',
            icon: cell.icon || (cell.isBoss ? '👑' : '👹'),
            lvl: cell.mobLvl,
            isBoss: cell.isBoss,
            location: 'Клановая Пирамида',
            gold: finalGold,
            crystals: rawCrystals,
            exp: finalExp
          });
        }

        let treasuryNote = '';
        if (treasuryRes.addedGold > 0 || treasuryRes.addedCrystals > 0) {
          treasuryNote = ` | В казну клана: +${treasuryRes.addedGold}🪙${treasuryRes.addedCrystals > 0 ? `, +${treasuryRes.addedCrystals}💎` : ''}`;
        }

        const killText = `🏆 Убит ${cell.isBoss ? '👑 ' : ''}${cell.mobName} (Ур.${cell.mobLvl})! +${finalGold}🪙${
          rawCrystals > 0 ? `, +${rawCrystals}💎` : ''
        }, +${finalExp} EXP | Клану: +${rawInfluence}⭐ влияния, +${rawClanExp} опыта клана${
          clanExpRes.leveledUp ? ` (🎉 Уровень клана ${clanExpRes.newLevel}!)` : ''
        }${treasuryNote}`;
        addLog(killText);
        showToast(
          `${cell.isBoss ? '👑 Босс повержен!' : '⚔️ Победа!'} +${rawInfluence}⭐ влияния, +${rawClanExp} опыта клана!`
        );
      } else {
        // Monster counterattacks!
        const mobDmg = Math.max(1, Number(cell.mobDmg || 25));
        const dodged = Math.random() * 100 < heroDodge;
        let nextHeroHp = hero.hp;

        if (!dodged) {
          nextHeroHp = Math.max(0, hero.hp - mobDmg);
        }

        // Update monster HP on grid
        const nextGrid = gridCells.map((rowArr, rIdx) =>
          rowArr.map((cCell, cIdx) => {
            if (rIdx === r && cIdx === c) {
              return { ...cCell, mobHp: nextMobHp };
            }
            return cCell;
          })
        );

        const updatedState = {
          ...pyramidState,
          gridCells: nextGrid
        };
        saveClanPyramidState(updatedState);
        setPyramidState(updatedState);

        if (nextHeroHp <= 0) {
          // Player died in Clan Pyramid -> refresh Clan Pyramid map and eject to main City screen!
          const nextSeed = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000) + 3;
          const freshState = getClanPyramidState();
          const refreshedGrid = generateClanPyramidGrid(config, nextSeed);
          const refreshedState = {
            ...freshState,
            gridCells: refreshedGrid,
            gridSeed: nextSeed,
            lastGridRespawnAt: Date.now()
          };
          saveClanPyramidState(refreshedState);
          setPyramidState(refreshedState);
          setPlayerPos({ row: 9, col: 1 });

          onUpdateHero({
            hp: 0,
            energy: 0,
            deaths: (hero.deaths || 0) + 1
          });
          showToast(
            `☠️ Вы пали от удара ${cell.mobName}! Вы выброшены в Город, а Клановая Пирамида обновлена.`
          );
          onClose();
        } else {
          onUpdateHero({
            hp: nextHeroHp,
            energy: nextEnergy
          });
          addLog(
            `⚔️ Удар по ${cell.mobName}: -${dmgDealt} HP${isCrit ? ' (КРИТ!)' : ''} [${nextMobHp}/${cell.mobMaxHp}]. ${
              dodged ? '💨 Уклонение!' : `💥 Ответ: -${mobDmg} HP`
            }`
          );
        }
      }
      return;
    }

    // 3. Gold / Crystal Sack on cell
    if (cell.type === 'sack') {
      if (hero.energy < 1) {
        showToast('⚡ Недостаточно энергии для шага! Нужно 1⚡.');
        return;
      }
      const sackGold = Number(cell.sackGold || 0);
      const sackCrystals = Number(cell.sackCrystals || 0);
      const sackInf = sackCrystals > 0 ? 15 : 5;
      const sackClanExp = sackCrystals > 0 ? 20 : 10;

      addClanInfluence(playerClan.id, sackInf, myNick);
      addClanExp(playerClan.id, sackClanExp, myNick);

      // Credit Clan Treasury ONLY from Clan Pyramid!
      const treasuryRes = creditClanTreasuryFromClanPyramid(
        playerClan.id,
        myNick,
        sackGold,
        sackCrystals,
        'сбор кланового тайника'
      );

      const nextGrid = gridCells.map((rowArr, rIdx) =>
        rowArr.map((cCell, cIdx) => {
          if (rIdx === r && cIdx === c) {
            return { type: 'empty' as const };
          }
          return cCell;
        })
      );

      const freshState = getClanPyramidState();
      const updatedState = {
        ...freshState,
        gridCells: nextGrid
      };
      saveClanPyramidState(updatedState);
      setPyramidState(updatedState);
      setPlayerPos({ row: r, col: c });

      const heroPatch = applyHeroExpAndRewards(hero, {
        hp: hero.hp,
        energy: Math.max(0, hero.energy - 1),
        goldDelta: sackGold,
        crystalsDelta: sackCrystals,
        expDelta: 0
      });
      onUpdateHero(heroPatch);
      if (onAddLootHistory) {
        onAddLootHistory({
          category: 'chest',
          title: sackCrystals > 0 ? 'Клановый тайник кристаллов' : 'Клановый сундук / мешок',
          icon: sackCrystals > 0 ? '💎' : '🧰',
          location: 'Клановая Пирамида',
          gold: sackGold,
          crystals: sackCrystals
        });
      }

      let treasuryNote = '';
      if (treasuryRes.addedGold > 0 || treasuryRes.addedCrystals > 0) {
        treasuryNote = ` (В казну клана: +${treasuryRes.addedGold}🪙${treasuryRes.addedCrystals > 0 ? `, +${treasuryRes.addedCrystals}💎` : ''})`;
      }

      const msg =
        sackCrystals > 0
          ? `💎 Найден клановый тайник: +${sackCrystals} 💎, +${sackInf}⭐ влияния, +${sackClanExp} опыта клана${treasuryNote}!`
          : `💰 Подобран клановый мешочек: +${sackGold} 🪙, +${sackInf}⭐ влияния, +${sackClanExp} опыта клана${treasuryNote}!`;
      addLog(msg);
      showToast(msg);
      return;
    }

    // 4. Empty step
    if (!isSameCell) {
      if (hero.energy < 1) {
        showToast('⚡ Недостаточно энергии для шага! Нужно 1⚡.');
        return;
      }
      setPlayerPos({ row: r, col: c });
      onUpdateHero({
        energy: Math.max(0, hero.energy - 1)
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-1.5 sm:p-2 backdrop-blur-md">
      <div className="relative flex h-[96dvh] max-h-[820px] w-full max-w-[440px] flex-col rounded-2xl border-2 border-red-500/80 bg-[#160e07] text-white shadow-2xl overflow-hidden">
        {/* Top Bar: Title, Throne Owner & View Switcher */}
        <div className="relative z-20 flex items-center justify-between border-b border-red-600/60 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 px-2.5 py-1.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-lg animate-pulse">🔺</span>
            <div className="min-w-0">
              <h2 className="text-[11px] font-black tracking-wider text-amber-300 uppercase truncate">
                {config.title || 'Клановая Пирамида (10×10)'}
              </h2>
              <div className="flex items-center gap-1 text-[8px] text-slate-300 truncate">
                <span>Владелец:</span>
                {pyramidState.controlledByClanName ? (
                  <strong className="text-amber-300 truncate">
                    [{pyramidState.controlledByClanTag}] {pyramidState.controlledByClanName}
                  </strong>
                ) : (
                  <span className="italic text-slate-400">Трон свободен</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode(viewMode === 'map' ? 'leaderboard' : 'map')}
              className="rounded-lg border border-amber-500/60 bg-amber-500/20 px-2 py-1 text-[8.5px] font-black text-amber-200 hover:bg-amber-500/30"
            >
              {viewMode === 'map' ? '🏆 Рейтинг' : '🗺️ Карта 10×10'}
            </button>
            {isAdmin && onOpenAdminClanPyramid && (
              <button
                onClick={onOpenAdminClanPyramid}
                className="rounded-lg border border-red-400 bg-red-900/70 px-1.5 py-1 text-[8.5px] font-black text-red-100 hover:bg-red-800"
                title="Редактировать Клановую Пирамиду в Админке"
              >
                ⚙️
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-bold text-slate-300 hover:border-red-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Clan Progress & Buffs Strip */}
        <div className="relative z-20 flex items-center justify-between gap-2 border-b border-amber-600/40 bg-slate-950/95 px-2.5 py-1 text-[8.5px] shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="rounded bg-amber-500/20 border border-amber-400/70 px-1 py-0.2 font-black text-amber-300 shrink-0">
              [{playerClan.tag}] Ур.{playerClan.level}/{MAX_CLAN_LEVEL}
            </span>
            <div className="flex-1 min-w-[70px] max-w-[130px]">
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all"
                  style={{ width: `${clanExpPct}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[6.5px] font-black text-white drop-shadow tabular-nums">
                  {playerClan.level >= MAX_CLAN_LEVEL
                    ? 'МАКС. УРОВЕНЬ'
                    : `Опыт клана: ${playerClan.exp || 0}/${clanNextExp}`}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-extrabold text-amber-300">⭐ {playerClan.influencePoints}</span>
            {clanBuffs.hasControl && (
              <span className="rounded bg-emerald-500/25 border border-emerald-400/60 px-1 py-0.2 text-[7.5px] font-black text-emerald-300">
                👑 Владелец (+{config.goldBonusPct}%🪙 +{config.expBonusPct}%✨)
              </span>
            )}
          </div>
        </div>

        {viewMode === 'map' ? (
          <>
            {/* Top HUD Section — identical to Regular PyramidScreen */}
            <div className="relative z-20 flex items-start justify-between gap-1.5 px-2 pt-1.5 pb-1 bg-gradient-to-b from-black/85 via-black/50 to-transparent shrink-0">
              {/* Left: Player Stats Panel */}
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/45 bg-slate-950/95 px-1.5 py-1 shadow-md">
                <div className="relative flex h-7 w-7 items-center justify-center rounded border border-amber-400 bg-slate-800 text-sm shrink-0 p-0.5 overflow-hidden">
                  <CharacterAvatar avatar={hero.avatar} nick={myNick} className="w-full h-full object-contain" />
                </div>

                <div className="flex w-24 flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[7.5px] font-extrabold leading-none">
                    <span className="truncate text-amber-300 max-w-[60px]">{myNick}</span>
                    <span className="text-purple-300">Ур.{hero.level}</span>
                  </div>

                  {/* HP */}
                  <div className="relative h-2 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                    <div className="h-full bg-red-600 transition-all" style={{ width: `${hpPercent}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-white drop-shadow tabular-nums">
                      ❤️ {hero.hp}/{heroMaxHp}
                    </div>
                  </div>

                  {/* Energy */}
                  <div className="relative h-2 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                    <div className="h-full bg-sky-600 transition-all" style={{ width: `${enPercent}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-white drop-shadow tabular-nums">
                      ⚡ {hero.energy}/{hero.maxEnergy}
                    </div>
                  </div>

                  {/* EXP */}
                  <div className="relative h-1.5 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                    <div className="h-full bg-purple-600 transition-all" style={{ width: `${expPercent}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[5px] font-bold text-white drop-shadow tabular-nums">
                      EXP {hero.exp}/{nextExp}
                    </div>
                  </div>
                </div>

                <div className="ml-0.5 flex flex-col items-end text-[8px] font-bold border-l border-slate-800 pl-1.5 tabular-nums leading-tight">
                  <span className="text-amber-400">🪙 {hero.gold}</span>
                  <span className="text-cyan-400">💎 {hero.crystals}</span>
                </div>
              </div>

              {/* Right: Respawn Timer & Combat Stats */}
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="rounded bg-slate-950/90 border border-red-500/40 px-1.5 py-0.5 text-[7.5px] font-bold text-red-300 shadow">
                    ⚔️ Урон: {heroTotalDmg} ({energyPerMove}⚡)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextSeed = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
                      const nextGrid = generateClanPyramidGrid(config, nextSeed);
                      const nextState = {
                        ...pyramidState,
                        gridCells: nextGrid,
                        gridSeed: nextSeed,
                        lastGridRespawnAt: Date.now()
                      };
                      saveClanPyramidState(nextState);
                      setPyramidState(nextState);
                      showToast('🔄 Монстры Клановой Пирамиды обновлены!');
                    }}
                    className="rounded bg-slate-950/90 border border-amber-500/40 px-1.5 py-0.5 text-[7.5px] text-slate-200 tabular-nums shadow hover:border-amber-400"
                    title="Таймер спавна монстров Клановой Пирамиды (нажмите для обновления)"
                  >
                    🔄 <span className="font-bold text-amber-300">{respawnTimeLeft}с</span>
                  </button>
                </div>

                <div className="rounded border border-amber-500/30 bg-slate-950/95 px-1.5 py-0.5 text-[7px] text-slate-300 text-right">
                  Босс на <strong className="text-red-300">[0,0]</strong> • Трон на{' '}
                  <strong className="text-purple-300">[0,9]</strong> • Выход <strong className="text-emerald-300">[9,0]</strong>
                </div>
              </div>
            </div>

            {/* Floating Left Quick Elixir Buttons — identical to Regular Pyramid */}
            <div className="absolute left-2 top-[118px] z-20 flex flex-col gap-1.5">
              <button
                onClick={() => handleLocalUsePotion('hp')}
                disabled={hero.hpPotions <= 0 || hero.hp >= heroMaxHp}
                className="group relative flex h-8 w-8 flex-col items-center justify-center rounded-lg border-2 border-red-400/80 bg-gradient-to-b from-red-800/90 via-red-950 to-slate-950 shadow-[0_0_10px_rgba(239,68,68,0.35)] transition-transform active:scale-90 disabled:opacity-40 hover:border-red-300"
                title="Эликсир жизни (+50 HP)"
              >
                <img src={ELIXIR_HP_IMG} alt="HP" className="h-5 w-5 object-contain drop-shadow" />
                <span className="text-[5.5px] font-black uppercase tracking-tighter text-red-200 leading-none">
                  HP
                </span>
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-red-200 bg-red-600 px-0.5 text-[7px] font-black text-white shadow tabular-nums">
                  {hero.hpPotions}
                </span>
              </button>

              <button
                onClick={() => handleLocalUsePotion('en')}
                disabled={hero.enPotions <= 0 || hero.energy >= hero.maxEnergy}
                className="group relative flex h-8 w-8 flex-col items-center justify-center rounded-lg border-2 border-sky-400/80 bg-gradient-to-b from-sky-800/90 via-sky-950 to-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.35)] transition-transform active:scale-90 disabled:opacity-40 hover:border-sky-300"
                title="Эликсир энергии (+20 EN)"
              >
                <img src={ELIXIR_EN_IMG} alt="EN" className="h-5 w-5 object-contain drop-shadow" />
                <span className="text-[5.5px] font-black uppercase tracking-tighter text-sky-200 leading-none">
                  EN
                </span>
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-sky-200 bg-sky-600 px-0.5 text-[7px] font-black text-white shadow tabular-nums">
                  {hero.enPotions}
                </span>
              </button>

              <button
                onClick={() => handleLocalUsePotion('exp')}
                disabled={Number(hero.expPotions || 0) <= 0}
                className={`group relative flex h-8 w-8 flex-col items-center justify-center rounded-lg border-2 bg-gradient-to-b from-purple-800/90 via-purple-950 to-slate-950 shadow-[0_0_10px_rgba(168,85,247,0.4)] transition-transform active:scale-90 disabled:opacity-40 hover:border-purple-300 ${
                  hero.expElixirUntil && hero.expElixirUntil > nowMs
                    ? 'border-emerald-400 ring-1 ring-emerald-400/60'
                    : 'border-purple-400/80'
                }`}
                title="Эликсир Опыта (+25% к опыту на 30 мин)"
              >
                <img src={ELIXIR_EXP_IMG} alt="EXP" className="h-5 w-5 object-contain drop-shadow" />
                <span className="text-[5.5px] font-black uppercase tracking-tighter text-purple-200 leading-none">
                  EXP
                </span>
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-purple-200 bg-purple-600 px-0.5 text-[7px] font-black text-white shadow tabular-nums">
                  {hero.expPotions || 0}
                </span>
              </button>
            </div>

            {/* 10x10 CLAN PYRAMID GRID AREA — 3D Isometric Stepped Stone Slabs with Ancient Blocks, Sand & Side Crystals */}
            <div className="relative z-10 flex flex-1 min-h-0 flex-col items-center justify-between px-1 pt-0.5 pb-1 overflow-hidden">
              {/* Background Volumetric Stone Blocks, Sand Dunes & Glowing Side Crystals */}
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
                <svg
                  viewBox="0 0 400 320"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full opacity-75"
                >
                  <defs>
                    <linearGradient id="clanSandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7f1d1d" stopOpacity="0.2" />
                      <stop offset="55%" stopColor="#451a03" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#1c0804" stopOpacity="0.95" />
                    </linearGradient>
                    <linearGradient id="clanCrystalRed" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#fecdd3" />
                      <stop offset="45%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#881337" />
                    </linearGradient>
                    <linearGradient id="clanCrystalCyan" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#a5f3fc" />
                      <stop offset="45%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#164e63" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,250 Q75,232 160,254 T310,248 T400,244 L400,320 L0,320 Z"
                    fill="url(#clanSandGrad)"
                  />
                  {/* Left & Right Glowing Crystals */}
                  <g opacity="0.85">
                    <circle cx="22" cy="252" r="18" fill="#f43f5e" fillOpacity="0.2" />
                    <polygon points="12,268 18,228 27,234 24,270" fill="url(#clanCrystalRed)" />
                    <polygon points="23,270 32,242 37,248 30,272" fill="url(#clanCrystalCyan)" opacity="0.85" />
                    <circle cx="378" cy="252" r="18" fill="#06b6d4" fillOpacity="0.2" />
                    <polygon points="388,268 382,228 373,234 376,270" fill="url(#clanCrystalCyan)" />
                    <polygon points="377,270 368,242 363,248 370,272" fill="url(#clanCrystalRed)" opacity="0.85" />
                  </g>
                </svg>
              </div>

              <div className="relative z-10 flex items-center justify-center gap-2 rounded border border-red-500/40 bg-black/80 px-2 py-0.5 text-[7px] text-slate-200 shadow shrink-0 mb-0.5">
                <span className="font-bold text-amber-300">
                  📍 Координаты: [ярус {10 - playerPos.row}, ст. {playerPos.col + 1}]
                </span>
                <span className="text-slate-400">• Нажимайте на соседние ступени для боя и движения</span>
              </div>

              <div
                className="relative z-10 flex flex-1 min-h-0 w-full items-center justify-center overflow-y-auto overflow-x-hidden px-0.5"
                style={
                  {
                    '--pyr-cell-w': 'clamp(28px, 8.2vw, 35px)',
                    '--pyr-cell-h': 'clamp(23px, 3.6dvh, 29px)'
                  } as React.CSSProperties
                }
              >
                <div className="my-auto flex flex-col items-center justify-center gap-[1.5px] sm:gap-[2px] w-full py-0.5">
                  {gridCells.map((row, rIdx) => (
                    <div
                      key={rIdx}
                      className="flex items-center justify-center gap-[2px] sm:gap-[2.5px] px-[2px] pt-[1px] pb-[2px] rounded-t-sm border-t border-red-400/25 bg-gradient-to-b from-[#5e2219]/90 via-[#3b140e]/95 to-[#1f0906] shadow-[0_3px_5px_rgba(0,0,0,0.85)]"
                      style={{ zIndex: rIdx + 1 }}
                    >
                      {row.map((cell, cIdx) => {
                        const isPlayer = rIdx === playerPos.row && cIdx === playerPos.col;
                        const isExit = rIdx === 9 && cIdx === 0;
                        const isThroneAltar = cell.type === 'nextTier' || cell.type === 'portal';
                        const isSack = cell.type === 'sack' && !isExit;
                        const otherFighter = !isPlayer
                          ? clanFighters.find((f) => f.row === rIdx && f.col === cIdx && f.hp > 0)
                          : undefined;
                        const isClanmate = Boolean(playerClan && otherFighter && otherFighter.clanId === playerClan.id);
                        const isMob = cell.type === 'mob' && (cell.mobHp || 0) > 0 && !isExit && !otherFighter;

                        const isAdjacent =
                          Math.abs(rIdx - playerPos.row) <= 1 && Math.abs(cIdx - playerPos.col) <= 1;

                        const isAltStone = (rIdx + cIdx) % 2 === 1;

                        let blockBg = isAltStone
                          ? 'bg-gradient-to-b from-[#9e4736] via-[#752e21] to-[#42160f] border-t-[#e89988]/70 border-x-[#9e4736]/60 border-b-[#1f0804] shadow-[inset_0_1.5px_1px_rgba(255,215,200,0.35),0_2px_3px_rgba(0,0,0,0.7)]'
                          : 'bg-gradient-to-b from-[#8c3b2b] via-[#66261b] to-[#38120c] border-t-[#d67763]/65 border-x-[#8c3b2b]/60 border-b-[#1a0603] shadow-[inset_0_1.5px_1px_rgba(255,200,180,0.28),0_2px_3px_rgba(0,0,0,0.7)]';

                        if (isExit) {
                          blockBg =
                            'bg-gradient-to-b from-emerald-500 via-emerald-700 to-green-950 border-t-emerald-200 border-x-emerald-400 border-b-emerald-950 shadow-[0_0_10px_rgba(16,185,129,0.85)]';
                        } else if (isPlayer) {
                          blockBg =
                            'bg-gradient-to-b from-[#d97757] via-[#9e422b] to-[#571d10] border-t-yellow-200 border-x-amber-300 border-b-amber-950 shadow-[0_0_12px_rgba(250,204,21,0.95),inset_0_2px_4px_rgba(254,240,138,0.5)]';
                        } else if (otherFighter) {
                          blockBg = isClanmate
                            ? 'bg-gradient-to-b from-[#254773] via-[#172b47] to-[#0f172a] border-t-emerald-300 border-x-emerald-400 border-b-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.75)]'
                            : 'bg-gradient-to-b from-[#991b1b] via-[#6b1414] to-[#330a0a] border-t-red-300 border-x-red-500 border-b-red-950 shadow-[0_0_10px_rgba(239,68,68,0.85)]';
                        } else if (isThroneAltar) {
                          blockBg =
                            'bg-gradient-to-b from-purple-500 via-amber-600 to-indigo-950 border-t-amber-200 border-x-amber-300 border-b-indigo-950 shadow-[0_0_10px_#f59e0b] animate-pulse';
                        } else if (isMob && cell.isBoss) {
                          blockBg =
                            'bg-gradient-to-b from-red-600 via-amber-800 to-red-950 border-t-amber-200 border-x-amber-400 border-b-red-950 shadow-[0_0_10px_rgba(245,158,11,0.85)]';
                        } else if (isSack) {
                          const isCrystal = (cell.sackCrystals || 0) > 0;
                          blockBg = isCrystal
                            ? 'bg-gradient-to-b from-cyan-600 via-sky-800 to-blue-950 border-t-cyan-200 border-x-cyan-400 border-b-slate-950'
                            : 'bg-gradient-to-b from-yellow-600 via-amber-700 to-amber-950 border-t-yellow-200 border-x-yellow-400 border-b-amber-950';
                        }

                        return (
                          <button
                            key={`${rIdx}-${cIdx}`}
                            ref={isPlayer ? playerCellRef : undefined}
                            onClick={() => handleCellClick(rIdx, cIdx)}
                            disabled={!isAdjacent && !isPlayer}
                            style={{
                              width: 'var(--pyr-cell-w)',
                              height: 'var(--pyr-cell-h)'
                            }}
                            className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-[4px] border border-b-[3px] text-[10px] font-bold transition-transform active:scale-90 ${blockBg} ${
                              !isAdjacent && !isPlayer ? 'opacity-80' : 'hover:-translate-y-[1px] ring-1 ring-amber-300/40'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 top-0 h-[32%] bg-gradient-to-b from-white/15 to-transparent"
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/45"
                            />

                            {/* Background cell content */}
                            {!isPlayer && !otherFighter && (
                              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                                {isExit ? (
                                  <div className="flex flex-col items-center leading-none" title="Выход в Город">
                                    <span className="text-[13px] sm:text-[15px] leading-none drop-shadow">🏃‍♂️</span>
                                    <span className="text-[6px] font-black uppercase text-emerald-100 leading-none">
                                      Выход
                                    </span>
                                  </div>
                                ) : isThroneAltar ? (
                                  <div
                                    className="flex flex-col items-center leading-none"
                                    title="Алтарь Трона Клановой Пирамиды (+100 ⭐ влияния, +120 опыта клана)"
                                  >
                                    <span className="text-[14px] sm:text-[16px] leading-none drop-shadow">👑</span>
                                    <span className="text-[6px] font-black uppercase text-amber-200 leading-none">
                                      Трон
                                    </span>
                                  </div>
                                ) : isSack ? (
                                  <span
                                    className="text-[15px] sm:text-[17px] leading-none drop-shadow"
                                    title={
                                      (cell.sackCrystals || 0) > 0
                                        ? `Клановый тайник кристаллов (+${cell.sackCrystals} 💎)`
                                        : `Клановый мешочек (+${cell.sackGold} 🪙)`
                                    }
                                  >
                                    {(cell.sackCrystals || 0) > 0 ? '💎' : '💰'}
                                  </span>
                                ) : isMob && cell.mobMaxHp ? (
                                  <>
                                    <div className="absolute top-[1.5px] h-[3px] w-[82%] rounded-full bg-red-950 border border-black/50 overflow-hidden">
                                      <div
                                        className="h-full bg-red-500 transition-all"
                                        style={{
                                          width: `${Math.max(0, ((cell.mobHp || 0) / cell.mobMaxHp) * 100)}%`
                                        }}
                                      />
                                    </div>
                                    <span className="pointer-events-none absolute bottom-[2px] h-1.5 w-4 rounded-full bg-black/55" />
                                    <div
                                      className="relative z-10 flex items-center justify-center overflow-hidden"
                                      style={{
                                        width: 'calc(var(--pyr-cell-h) - 8px)',
                                        height: 'calc(var(--pyr-cell-h) - 8px)'
                                      }}
                                      title={`${cell.mobName} (Ур.${cell.mobLvl}) • HP: ${cell.mobHp}/${cell.mobMaxHp} • +${cell.mobInfluenceReward || 15}⭐`}
                                    >
                                      <ItemIcon
                                        icon={cell.icon || '🦂'}
                                        alt={cell.mobName}
                                        className="text-[15px] sm:text-[17px] leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)]"
                                        imgClassName="w-full h-full object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)]"
                                      />
                                    </div>
                                    <span className="absolute bottom-[0.5px] z-20 rounded bg-black/70 px-0.5 text-[6.5px] font-black text-amber-100 drop-shadow leading-none">
                                      {cell.isBoss ? '👑' : ''}L{cell.mobLvl}
                                    </span>
                                  </>
                                ) : (
                                  <span className="h-1 w-2 rounded-full bg-amber-950/45 shadow-[0_0.5px_0_rgba(255,210,180,0.2)]" />
                                )}
                              </div>
                            )}

                            {/* Other Clan Fighter Avatar */}
                            {otherFighter && !isPlayer && (
                              <div
                                className="relative z-20 flex items-center justify-center w-full h-full"
                                title={`${isClanmate ? '🛡️ Соклановец' : '⚔️ Вражеский клан'}: [${otherFighter.clanTag}] ${otherFighter.nick} (${otherFighter.lvl} ур.) • HP: ${otherFighter.hp}/${otherFighter.maxHp}`}
                              >
                                {/* Mini HP bar */}
                                <div className={`absolute top-[1.5px] z-30 h-[3px] w-[82%] rounded-full overflow-hidden border ${
                                  isClanmate ? 'bg-slate-950 border-emerald-400/60' : 'bg-red-950 border-red-400/80'
                                }`}>
                                  <div
                                    className={`h-full ${isClanmate ? 'bg-emerald-400' : 'bg-red-500'}`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (otherFighter.hp / Math.max(1, otherFighter.maxHp)) * 100))}%`
                                    }}
                                  />
                                </div>
                                <span className="pointer-events-none absolute bottom-[1.5px] h-1.5 w-5 rounded-full bg-black/60 blur-[0.5px]" />
                                <CharacterAvatar
                                  avatar={otherFighter.avatar}
                                  nick={otherFighter.nick}
                                  size="auto"
                                  style={{
                                    width: 'calc(var(--pyr-cell-h) - 6px)',
                                    height: 'calc(var(--pyr-cell-h) - 6px)'
                                  }}
                                  className="relative z-10 mt-0.5 text-[15px] sm:text-[17px] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]"
                                />
                              </div>
                            )}

                            {/* Player Avatar */}
                            {isPlayer && (
                              <div
                                className="relative z-20 flex items-center justify-center w-full h-full"
                                title={`Вы (${hero.level} ур.) • ${Math.round(hero.hp)}/${heroMaxHp} HP • [${playerClan?.tag || 'КЛАН'}] [ряд ${rIdx}, кл. ${cIdx}]`}
                              >
                                {/* Player mini HP bar */}
                                <div className="absolute top-[1.5px] z-30 h-[3px] w-[82%] rounded-full bg-slate-900/90 overflow-hidden border border-emerald-600/50">
                                  <div
                                    className="h-full bg-emerald-500 transition-all duration-200"
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (hero.hp / Math.max(1, heroMaxHp)) * 100))}%`
                                    }}
                                  />
                                </div>
                                <span className="pointer-events-none absolute bottom-[1.5px] h-1.5 w-5 rounded-full bg-black/65 blur-[0.5px]" />
                                <CharacterAvatar
                                  avatar={hero.avatar}
                                  nick={myNick}
                                  size="auto"
                                  style={{
                                    width: 'calc(var(--pyr-cell-h) - 5px)',
                                    height: 'calc(var(--pyr-cell-h) - 5px)'
                                  }}
                                  className="relative z-10 mt-0.5 text-[16px] sm:text-[18px] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]"
                                />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Compact Combat Log */}
            <div className="relative z-20 border-t border-red-900/60 bg-slate-950/95 px-2.5 py-1.5 h-24 flex flex-col shrink-0">
              <div className="flex items-center justify-between text-[8px] font-bold text-amber-300 mb-0.5">
                <span>⚔️ Лог сражений в Клановой Пирамиде:</span>
                <span className="text-slate-400">
                  Бонусы владельца: +{config.goldBonusPct}%🪙 +{config.expBonusPct}%✨ +{config.dmgBonusPct}%⚔️
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 text-[8px] pr-1">
                {combatLog.length === 0 ? (
                  <div className="text-slate-500 italic py-2 text-center">
                    Нажимайте на соседние клетки с монстрами, чтобы сражаться за влияние и прокачивать уровень клана!
                  </div>
                ) : (
                  combatLog.map((log) => (
                    <div key={log.id} className="truncate text-slate-200">
                      <span className="text-slate-500 mr-1">[{log.time}]</span>
                      <span>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          /* Leaderboard & Clan Pyramid Info View */
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="rounded-xl border border-amber-500/60 bg-slate-900/90 p-3 shadow-md">
              <h4 className="text-xs font-black uppercase text-amber-300 border-b border-slate-800 pb-1.5 mb-2">
                🏆 Рейтинг Кланов за Контроль Пирамиды
              </h4>
              <div className="space-y-1.5">
                {pyramidState.topClansLeaderboard.length === 0 ? (
                  <div className="text-center text-slate-500 py-4 text-[10px]">
                    Пока ни один клан не заработал очков влияния. Сражайтесь на карте 10×10!
                  </div>
                ) : (
                  pyramidState.topClansLeaderboard.map((c, idx) => (
                    <div
                      key={c.clanId}
                      className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[10px] ${
                        idx === 0
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 font-bold'
                          : 'border-slate-800 bg-slate-950/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[10px] font-black text-amber-400 w-5">#{idx + 1}</span>
                        <span className="rounded bg-slate-800 px-1 text-[8.5px] font-mono text-amber-300">
                          [{c.clanTag}]
                        </span>
                        <span className="truncate">{c.clanName}</span>
                      </div>
                      <span className="font-extrabold text-amber-300 shrink-0">{c.influence} ⭐</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[10px] space-y-1.5">
              <h5 className="font-black uppercase text-amber-300">
                🎁 Бонусы Клана-Владельца Пирамиды:
              </h5>
              <p className="text-slate-300">
                Клан на 1-м месте по очкам влияния удерживает контроль над Клановой Пирамидой и даёт всем своим участникам:
              </p>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li>
                  <strong className="text-amber-300">+{config.goldBonusPct}% к золоту</strong> во всех пирамидах
                </li>
                <li>
                  <strong className="text-purple-300">+{config.expBonusPct}% к опыту</strong> во всех сражениях
                </li>
                <li>
                  <strong className="text-red-300">+{config.dmgBonusPct}% к урону</strong> персонажа
                </li>
                <li>
                  <strong className="text-emerald-300">+{config.hpBonusPct}% к здоровью</strong> персонажа
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[10px] space-y-1.5">
              <h5 className="font-black uppercase text-red-300">
                👹 Обитатели Клановой Пирамиды ({config.monsters.length}):
              </h5>
              <div className="grid grid-cols-1 gap-1.5">
                {config.monsters.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2 text-[9px]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden p-0.5">
                        <ItemIcon icon={m.icon} alt={m.name} />
                      </div>
                      <div>
                        <div className="font-bold text-white">
                          {m.isBoss ? '👑 ' : ''}{m.name} (Ур.{m.lvl})
                        </div>
                        <div className="text-[8px] text-slate-400">
                          ❤️ {m.maxHp} HP • ⚔️ {m.dmg} Урон • На карте: {m.spawnCount} шт.
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[8px] font-bold">
                      <div className="text-amber-300">+{m.influenceReward} ⭐ влияния</div>
                      <div className="text-purple-300">+{m.clanExpReward} опыта клана</div>
                      <div className="text-yellow-400">
                        +{m.goldReward}🪙 {m.crystalReward > 0 ? `+${m.crystalReward}💎` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
