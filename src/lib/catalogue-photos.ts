import {siteUrl} from './site-path';
import type {Entry} from './club-types';

type PhotoKey='art'|'business'|'city'|'books'|'coffee'|'walk'|'carpathians'|'beauty'|'help';
const descriptions:Record<PhotoKey,string>={
 art:'Творчість і робота з глиною',business:'Спільна робота та підприємництво',
 city:'Знайомство з містом',books:'Книги для спільного читання',coffee:'Зустріч за кавою',
 walk:'Прогулянка на природі',carpathians:'Гірський краєвид Карпат',
 beauty:'Догляд і краса',help:'Взаємодопомога та волонтерство',
};
// A title-specific match wins over the broad category (e.g. a Carpathian
// trip remains mountains even when its category is "Walks"). No remote calls.
export function cataloguePhoto(entry:Pick<Entry,'title'|'kind'|'category'>){
 const title=entry.title.toLocaleLowerCase('uk-UA');
 let key:PhotoKey;
 if(/карпат|яремч|буковел|говерл/.test(title))key='carpathians';
 else if(/книж|книг|читан|літератур|литератур/.test(title))key='books';
 else if(/кав[аиу]|кофе|coffee/.test(title))key='coffee';
 else if(/керам|гончар|творч|малюван|рисован/.test(title))key='art';
 else if(/підприєм|предприним|бізнес|бизнес|стартап/.test(title))key='business';
 else if(/новеньк|новач|нович|міст[іоа]|город/.test(title))key='city';
 else if(/прогулян|прогул|парк|похід|поход/.test(title))key='walk';
 else if(entry.kind==='beauty')key='beauty';
 else if(entry.kind==='business'||entry.category==='Підприємництво')key='business';
 else if(entry.kind==='help')key='help';
 else if(entry.category==='Книги')key='books';
 else if(entry.category==='Творчість')key='art';
 else if(entry.category==='Моє місто')key='city';
 else if(['Прогулянки','Спорт'].includes(entry.category))key='walk';
 else key='coffee';
 const detailPosition=key==='coffee'?'center 90%':key==='carpathians'?'center 45%':key==='business'||key==='art'?'center 30%':'center 50%';
 return {key,src:siteUrl(`/catalogue/${key}.webp`),detailPosition,alt:`Ілюстративне фото: ${descriptions[key]}`};
}
