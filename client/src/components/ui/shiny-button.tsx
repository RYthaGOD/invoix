import type React from "react"

interface ShinyButtonProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  variant?: "primary" | "secondary"
}

export function ShinyButton({ children, onClick, className = "", variant = "primary" }: ShinyButtonProps) {
  return (
    <button
      className={`shiny-cta shiny-cta-${variant} ${className}`}
      onClick={onClick}
    >
      <span>{children}</span>
    </button>
  )
}
