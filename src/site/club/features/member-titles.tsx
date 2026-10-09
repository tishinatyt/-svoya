import { Flower2, Heart, Sparkles, Sun } from 'lucide-react';
import type { Profile } from '@/lib/club-types';
import { memberTitles, titleKeys, visibleTitle } from '@/lib/member-titles';

const icons = { svoya: Flower2, active: Heart, inspirer: Sparkles, ambassador: Sun };

export function MemberTitleBadge({profile}: {profile: Profile | null | undefined}) {
  const key=visibleTitle(profile);
  if (!key) return null;
  const title=memberTitles[key], Icon=icons[key];
  return <span className={`sv-member-title sv-member-title-${key}`} title={title.description} aria-label={`Титул: ${title.label}`}>
    <Icon size={14} aria-hidden="true" />{title.label}
  </span>;
}

export function MemberTitleGuide({profile}: {profile?: Profile | null}) {
  const current=visibleTitle(profile);
  return <section className="sv-title-guide" aria-label="Титули клубу">
    <div className="sv-title-guide-intro">
      <span className="sv-overline">ТВІЙ ВНЕСОК У СПІЛЬНЕ КОЛО</span>
      <h3>{current ? memberTitles[current].description : 'У кожної свій шлях у клубі.'}</h3>
      <p>{profile && !current ? 'Твій титул з’явиться після схвалення анкети. ' : ''}Титули відзначають участь і турботу про спільноту. Можна бути своєю у власному темпі.</p>
    </div>
    <details>
      <summary>Титули та як їх отримати</summary>
      <ol className="sv-title-path">
        {titleKeys.map(key=>{const title=memberTitles[key], Icon=icons[key];return <li key={key} className={current===key?'is-current':''}>
          <span className={`sv-title-step sv-member-title-${key}`} aria-hidden="true"><Icon size={21}/></span>
          <div><h4>{title.label}{current===key && <small>Твій титул</small>}</h4><p>{title.criteria}</p></div>
        </li>;})}
      </ol>
      <p className="sv-title-note">Після «Своєї» титул призначає команда за підтверджений внесок, а не лише за записи на події. Підвищення не залежить від оплати чи кількості повідомлень. Титул не надає прав модерації та не є гарантією особи чи якості послуг.</p>
    </details>
  </section>;
}
