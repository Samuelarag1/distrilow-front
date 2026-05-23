"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Construction, Clock, CheckCircle } from "lucide-react"

interface UnderDevelopmentProps {
  title: string
  description: string
  features: string[]
  estimatedCompletion?: string
}

export function UnderDevelopment({
  title,
  description,
  features,
  estimatedCompletion = "Próximamente",
}: UnderDevelopmentProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="w-fit">
          <Clock className="mr-2 h-4 w-4" />
          En Desarrollo
        </Badge>
      </div>

      <Card className="border-dashed border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Construction className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Módulo en Desarrollo</CardTitle>
          <p className="text-muted-foreground">
            Estamos trabajando en esta funcionalidad para ofrecerte la mejor experiencia
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              {estimatedCompletion}
            </Badge>
          </div>

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Funcionalidades Planificadas
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Mientras tanto, puedes usar las otras funcionalidades disponibles del sistema.
              <br />
              ¡Gracias por tu paciencia!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
