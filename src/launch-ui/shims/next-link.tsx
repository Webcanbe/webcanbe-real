import type { AnchorHTMLAttributes, ReactNode } from "react"

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string | URL
  children?: ReactNode
}

export default function Link({ href, children, ...props }: LinkProps) {
  return <a href={String(href)} {...props}>{children}</a>
}
