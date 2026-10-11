import { siteUrl } from '@/lib/site-path';
import './brand.css';

export default function Brand({ className = '', inverse = false }: { className?: string; inverse?: boolean }) {
  return <a className={`sv-brand ${inverse ? 'sv-brand-inverse' : ''} ${className}`} href={siteUrl('/')} aria-label="СВОЯ — жіночий клуб, головна">
    <img className="sv-brand-logo" src={siteUrl('/brand/svoya-logo-20261011.png')} width={1668} height={550} alt="" />
  </a>;
}
