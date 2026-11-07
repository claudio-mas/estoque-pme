import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        // Estados: fundo suave e texto do par -subtle (validados pela verificação de contraste).
        destructive:
          "border-destructive/50 bg-destructive-subtle text-destructive-subtle-foreground *:data-[slot=alert-description]:text-destructive-subtle-foreground",
        warning:
          "border-warning/50 bg-warning-subtle text-warning-subtle-foreground *:data-[slot=alert-description]:text-warning-subtle-foreground",
        success:
          "border-success/50 bg-success-subtle text-success-subtle-foreground *:data-[slot=alert-description]:text-success-subtle-foreground",
        info:
          "border-info/50 bg-info-subtle text-info-subtle-foreground *:data-[slot=alert-description]:text-info-subtle-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * `role` padrão: "alert" (urgente) para destructive e warning; "status" para os demais.
 * Para um aviso estático que não deve ser anunciado, passe `role={undefined}`.
 */
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant ?? "default"}
      role={variant === "destructive" || variant === "warning" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
