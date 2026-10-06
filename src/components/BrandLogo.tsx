interface BrandLogoProps {
  className?: string
  imageClassName?: string
}

export default function BrandLogo({ className = '', imageClassName = '' }: BrandLogoProps) {
  return (
    <span className={`inline-flex flex-col leading-none text-[#512838] ${className}`} aria-label="СВОЯ — жіночий клуб">
      <span className={`font-[Georgia] text-[1.75rem] font-normal tracking-[0.08em] ${imageClassName}`}>СВОЯ</span>
      <span className="mt-1 text-[0.42rem] uppercase tracking-[0.18em] text-[#866673]">жіночий клуб</span>
    </span>
  )
}
