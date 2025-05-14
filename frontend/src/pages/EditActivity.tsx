// src/pages/EditActivity.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "components/Layout";
import { useUserGuardContext } from "app";
import { useActivityStore, Activity } from "../utils/activityStore";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Timestamp, doc, getDoc, getFirestore } from "firebase/firestore";
import { toast, Toaster } from "sonner";
import { firestore } from "../utils/firebase";

const CATEGORIES = [
  "Sports", "Dining", "Hiking", "Gaming",
  "Movies", "Travel", "Music", "Cooking",
] as const;

export default function EditActivity() {
  const { user } = useUserGuardContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get("id");

  const { updateActivity } = useActivityStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Activity>>({});

  // load activity on mount
  useEffect(() => {
    if (!activityId) {
      toast.error("No activity ID provided");
      navigate(-1);
      return;
    }

    const load = async () => {
      try {
        const ref = doc(firestore, "activities", activityId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          toast.error("Activity not found");
          navigate(-1);
          return;
        }
        const data = snap.data() as Activity;
        if (data.createdBy.userId !== user.uid) {
          toast.error("You can only edit your own activities");
          navigate(-1);
          return;
        }
        // convert Timestamp to ISO for datetime-local
        const dt =
          data.dateTime instanceof Timestamp
            ? data.dateTime.toDate().toISOString().slice(0, 16)
            : new Date(data.dateTime).toISOString().slice(0, 16);

        setForm({ ...data, dateTime: dt });
      } catch (err) {
        console.error(err);
        toast.error("Failed to load activity");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activityId, user.uid, navigate]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    setForm((f) => ({
        ...f,
        [name]:
            type === "checkbox"
                ? checked
                : name === "maxParticipants"
                ? Number(value)
                : value,
    }));
};
  const handleSave = async () => {
    if (!activityId) return;
    setSaving(true);
    try {
      // convert ISO back to Firestore Timestamp
      const dt =
        typeof form.dateTime === "string"
          ? Timestamp.fromDate(new Date(form.dateTime))
          : form.dateTime;

      await updateActivity(activityId, {
        title: form.title!,
        description: form.description!,
        location: form.location!,
        category: form.category!,
        dateTime: dt,
        isPublic: form.isPublic ?? true,
        maxParticipants: form.maxParticipants ?? null,
      });
      toast.success("Activity updated!");
      navigate(-1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update activity");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p>Loading activity…</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout contentClassName="container mx-auto px-4 py-6 max-w-xl">
      <Toaster position="top-right" />
      <h1 className="text-2xl font-bold mb-4">Edit Activity</h1>

      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            value={form.title || ""}
            onChange={handleChange}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={form.description || ""}
            onChange={handleChange}
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            value={form.location || ""}
            onChange={handleChange}
          />
        </div>

        <div>
          <Label htmlFor="dateTime">Date & Time</Label>
          <Input
            id="dateTime"
            name="dateTime"
            type="datetime-local"
            value={form.dateTime as string}
            onChange={handleChange}
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            className="block w-full border rounded px-2 py-1"
            value={form.category || CATEGORIES[0]}
            onChange={handleChange}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <Switch
            id="isPublic"
            name="isPublic"
            checked={form.isPublic ?? true}
            onCheckedChange={(val) =>
              setForm((f) => ({ ...f, isPublic: val }))
            }
          />
          <Label htmlFor="isPublic">Public</Label>
        </div>

        <div>
          <Label htmlFor="maxParticipants">Max Participants</Label>
          <Input
            id="maxParticipants"
            name="maxParticipants"
            type="number"
            min={1}
            value={form.maxParticipants ?? ""}
            onChange={handleChange}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
