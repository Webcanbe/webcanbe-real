import type { ImgHTMLAttributes } from "react"

export type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | { src: string }
  unoptimized?: boolean
  priority?: boolean
}

export default function Image({ src, unoptimized: _unoptimized, priority: _priority, ...props }: ImageProps) {
  return <img src={typeof src === "string" ? src : src.src} {...props} />
}
