import { siteUrl } from '@/lib/site-path';
import './brand.css';

export default function Brand({ className = '', inverse = false }: { className?: string; inverse?: boolean }) {
  return <a className={`sv-brand ${inverse ? 'sv-brand-inverse' : ''} ${className}`} href={siteUrl('/')} aria-label="СВОЯ — жіночий клуб, головна">
    <img className="sv-brand-mark" src={siteUrl('/brand/svoya-mark.png')} width={48} height={48} alt="" />
    <span className="sv-brand-copy"><strong>СВОЯ</strong><small>жіночий клуб</small></span>
  </a>;
}
