// Реестр всех моделей: [id, русское название, функция-сборщик] по категориям.
import { characters } from './characters.js';
import { weapons } from './weapons.js';
import { enemies } from './enemies.js';
import { bosses } from './bosses.js';
import { chests } from './chests.js';
import { loot } from './loot.js';
import { props } from './props.js';
import { locations } from './locations.js';

export const CATEGORIES = [
  { id: 'characters', title: 'Главные персонажи', list: characters },
  { id: 'weapons', title: 'Оружие', list: weapons },
  { id: 'enemies', title: 'Враги (слизни)', list: enemies },
  { id: 'bosses', title: 'Боссы', list: bosses },
  { id: 'chests', title: 'Сундуки', list: chests },
  { id: 'loot', title: 'Добыча', list: loot },
  { id: 'props', title: 'Дополнительные элементы', list: props },
  { id: 'locations', title: 'Локации (карты)', list: locations },
];
