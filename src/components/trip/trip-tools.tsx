"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Bot, Calculator, ClipboardCheck, Luggage, Share2, Users } from "lucide-react";
import { JournalPanel } from "./tools/journal-panel";
import { CollabPanel } from "./tools/collab-panel";
import { ChatPanel } from "./tools/chat-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GuestTrip } from "@/lib/guest/trips";
import type { WizardContext } from "@/components/wizard/step-props";
import { BudgetPanel } from "./tools/budget-panel";
import { PackingPanel } from "./tools/packing-panel";
import { ChecklistPanel } from "./tools/checklist-panel";
import { SharePanel } from "./tools/share-panel";

type Props = { trip: GuestTrip; ctx: WizardContext; onTripChange: (trip: GuestTrip) => void; readOnly?: boolean };

/** Budget, packing list, pre-trip checklist, export/share/offline, journal, collaborators, AI assistant. */
export function TripTools({ trip, ctx, onTripChange, readOnly = false }: Props) {
  const t = useTranslations("tools");
  const [tab, setTab] = useState("checklist");
  const tabs = [
    { id: "checklist", icon: ClipboardCheck },
    { id: "packing", icon: Luggage },
    { id: "budget", icon: Calculator },
    { id: "share", icon: Share2 },
    { id: "journal", icon: BookOpen },
    { id: "collab", icon: Users },
    { id: "chat", icon: Bot },
  ] as const;
  return (
    <div>
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <Tabs value={tab} onValueChange={setTab} className="mt-3">
        <TabsList aria-label={t("title")} className="h-auto flex-wrap">
          {tabs.map(({ id, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="gap-1.5">
              <Icon className="size-4" aria-hidden />
              {t(`tabs.${id}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="checklist" className="mt-3">
          <ChecklistPanel trip={trip} onTripChange={onTripChange} />
        </TabsContent>
        <TabsContent value="packing" className="mt-3">
          <PackingPanel trip={trip} ctx={ctx} onTripChange={onTripChange} />
        </TabsContent>
        <TabsContent value="budget" className="mt-3">
          <BudgetPanel trip={trip} />
        </TabsContent>
        <TabsContent value="share" className="mt-3">
          <SharePanel trip={trip} ctx={ctx} onTripChange={onTripChange} />
        </TabsContent>
        <TabsContent value="journal" className="mt-3">
          <JournalPanel trip={trip} onTripChange={onTripChange} />
        </TabsContent>
        <TabsContent value="collab" className="mt-3">
          <CollabPanel trip={trip} />
        </TabsContent>
        <TabsContent value="chat" className="mt-3">
          <ChatPanel trip={trip} onTripChange={onTripChange} readOnly={readOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
