import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("Trader");
  const [accountSize, setAccountSize] = useState(10000);
  const [defaultRisk, setDefaultRisk] = useState(1);
  const [experience, setExperience] = useState("beginner");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and risk preferences</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Profile</h2>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Display Name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-muted border-border" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Experience Level</Label>
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Risk Preferences</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Account Size ($)</Label>
            <Input type="number" value={accountSize} onChange={(e) => setAccountSize(Number(e.target.value))} className="bg-muted border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Risk %</Label>
            <Input type="number" value={defaultRisk} onChange={(e) => setDefaultRisk(Number(e.target.value))} step={0.5} min={0.1} max={10} className="bg-muted border-border" />
          </div>
        </div>
      </div>

      <Button className="w-full">Save Settings</Button>
    </div>
  );
}
