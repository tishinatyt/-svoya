import { useEffect, useState } from 'react'
import CategoryPlaceholder from '@/components/CategoryPlaceholder'

interface EventMediaProps {
  category: string
  coverUrl?: string | null
  alt?: string
  className?: string
  imageClassName?: string
  compactFallback?: boolean
}

export default function EventMedia({ category, coverUrl, alt = '', className = 'h-32 w-full', imageClassName = '', compactFallback = false }: EventMediaProps) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => setImageFailed(false), [coverUrl])

  if (!coverUrl || imageFailed) return <CategoryPlaceholder category={category} className={className} compact={compactFallback} />

  return <img src={coverUrl} alt={alt} onError={() => setImageFailed(true)} className={`${className} object-cover ${imageClassName}`} />
}
