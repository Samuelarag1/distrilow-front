"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(
  (
    {
      className,
      children,
      onInteractOutside,
      onPointerDownOutside,
      onFocusOutside,
      ...props
    },
    ref
  ) => {
    const isToastViewportTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(target.closest("[data-radix-toast-viewport]"))
    }

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            // On a phone: 1rem of margin on each side and never taller than
            // the screen (it scrolls inside), so the form never touches the
            // edges or gets cut off at the top and bottom. A caller's own
            // w-/max-h-/overflow- classes still win (tailwind-merge).
            "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] focus:outline-none max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            className
          )}
          onInteractOutside={(event) => {
            if (isToastViewportTarget(event.target)) {
              event.preventDefault()
              return
            }
            onInteractOutside?.(event)
          }}
          onPointerDownOutside={(event) => {
            if (isToastViewportTarget(event.target)) {
              event.preventDefault()
              return
            }
            onPointerDownOutside?.(event)
          }}
          onFocusOutside={(event) => {
            if (isToastViewportTarget(event.target)) {
              event.preventDefault()
              return
            }
            onFocusOutside?.(event)
          }}
          {...props}
        >
          {children}
          {/* 40px target: easy to hit with a thumb (WCAG 2.5.8 asks for 24px at least). */}
          <DialogPrimitive.Close className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    )
  }
)
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  sticky = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /** For long forms: the buttons stay at the bottom while the dialog scrolls. */
  sticky?: boolean
}) => (
  <div
    className={cn(
      // Stacked full-width buttons on a phone, with room between them.
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      // Negative margins and -bottom-6 match DialogContent's p-6 (sticky is
      // measured inside the scroll padding), so the bar sits on the dialog's
      // bottom edge and covers what scrolls under it. Side by side even on a
      // phone: stacked, two buttons take a quarter of a small screen.
      // `!-mb-6`: inside a form with space-y-*, that rule's margin-bottom: 0
      // is more specific and would leave a blank strip under the buttons.
      sticky &&
        "sticky -bottom-6 -mx-6 !-mb-6 flex-row border-t bg-background px-6 py-3 [&>*]:flex-1 sm:[&>*]:flex-none",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
