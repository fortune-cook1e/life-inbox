import { Clock3, Settings2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function SettingsPage() {
  return (
    <section className="flex h-[100dvh] min-h-0 flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border/80 bg-background">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <SidebarTrigger className="size-9" />
          <div className="h-5 w-px bg-border" aria-hidden="true" />
          <h1 className="text-sm font-medium">Settings</h1>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Settings2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Personalize how the assistant works in this browser.
              </p>
            </div>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle>Local timezone</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Timezone preferences will be available in the next frontend slice. Until then, The
                assistant uses the timezone reported by your browser.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </section>
  );
}
