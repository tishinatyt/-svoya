import { siteUrl } from '@/lib/site-path'

interface BrandLogoProps {
  className?: string
  imageClassName?: string
}

export default function BrandLogo({ className = '', imageClassName = '' }: BrandLogoProps) {
  return (
    <span className={`inline-flex ${className}`} aria-label="СВОЯ — жіночий клуб">
      <img className={`h-auto w-full object-contain ${imageClassName}`} src={siteUrl('/brand/svoya-logo-20261011.png')} width={1668} height={550} alt="" />
    </span>
  )
}
