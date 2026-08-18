import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { fetchWordFrequency, saveWordToVocabulary, removeWordFromVocabulary, fetchUserVocabulary, type WordFrequency } from "@/lib/vocabulary";
import { seedVocabularyToReviews, removeVocabularyReviewItem } from "@/lib/study";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/quran")({
  head: () => ({
    meta: [
      { title: "Interactive Qur'an study — QuranRoots" },
      {
        name: "description",
        content:
          "Read the Qur'an with translation, transliteration, recitation audio and word-by-word study.",
      },
      { property: "og:title", content: "Interactive Qur'an study — QuranRoots" },
      {
        property: "og:description",
        content: "Verified Qur'anic text with translation, audio and word-level study tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuranPage,
});

const CATEGORIES = [null, "noun", "verb", "particle", "phrase"] as const;

function QuranPage() {
  const { d, t, locale } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const page = d.quran.page;
  const vocab = d.quran.vocabulary;
  const wordCopy = d.quran.word;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(null);

  const { data: words } = useQuery({
    queryKey: ["word-frequency", category, search],
    queryFn: ({ signal }) => fetchWordFrequency({ limit: 50, category, search, signal }),
  });

  const { data: userVocab } = useQuery({
    queryKey: ["user-vocabulary", user?.id],
    queryFn: () => (user ? fetchUserVocabulary(user.id) : []),
    enabled: Boolean(user),
  });

  const savedWordIds = new Set((userVocab ?? []).map((v) => v.word_id));

  const saveMutation = useMutation({
    mutationFn: ({ wordId, saved }: { wordId: string; saved: boolean }) => {
      if (!user) throw new Error("unauthenticated");
      return saved ? removeWordFromVocabulary(user.id, wordId) : saveWordToVocabulary(user.id, wordId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-vocabulary"] });
    },
  });

  const seedMutation = useMutation({
    mutationFn: ({ word, save }: { word: WordFrequency; save: boolean }) => {
      if (!user) throw new Error("unauthenticated");
      return save
        ? seedVocabularyToReviews(user.id, word, locale)
        : removeVocabularyReviewItem(user.id, word.id);
    },
  });

  const handleToggle = (word: WordFrequency) => {
    if (!user) return;
    const isSaved = savedWordIds.has(word.id);
    saveMutation.mutate(
      { wordId: word.id, saved: isSaved },
      {
        onSuccess: () => {
          seedMutation.mutate({ word, save: !isSaved });
          toast.success(isSaved ? vocab.removeToast : vocab.saveToast);
        },
        onError: () => toast.error(d.common.errors.generic),
      },
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{page.title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{page.intro}</p>

        <Card className="mt-8 shadow-elevated">
          <CardContent className="p-6 sm:p-8">
            <Badge variant="secondary">{page.typographyBadge}</Badge>
            <p className="text-quran mt-4 text-right text-foreground" lang="ar" dir="rtl">
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{page.typographyNote}</p>
          </CardContent>
        </Card>

        <section className="mt-12" aria-labelledby="vocabulary">
          <h2 id="vocabulary" className="font-display text-2xl font-bold">
            {vocab.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{vocab.intro}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder={vocab.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Button
                  key={c ?? "all"}
                  variant={category === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(c)}
                >
                  {c ? wordCopy[c] : vocab.filterAll}
                </Button>
              ))}
            </div>
          </div>

          {!user && (
            <p className="mt-4 text-sm text-muted-foreground">{vocab.signInToSave}</p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(words ?? []).map((word) => {
              const isSaved = savedWordIds.has(word.id);
              return (
                <Card key={word.id} className="h-full shadow-soft">
                  <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-right" dir="rtl" lang="ar">
                      <p className="text-quran text-2xl font-semibold">{word.word}</p>
                      {word.transliteration && (
                        <p className="text-sm text-muted-foreground">{word.transliteration}</p>
                      )}
                    </div>
                    {word.frequency_rank && (
                      <Badge variant="outline">
                        {t("quran.vocabulary.frequencyRank", { rank: word.frequency_rank })}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">{wordCopy.meaning}:</span>{" "}
                      <span className="font-medium">{word.meaning}</span>
                      {d.common.language.fr === "Français" && word.meaning_fr && (
                        <span className="block text-xs text-muted-foreground">{word.meaning_fr}</span>
                      )}
                    </p>
                    {word.root && (
                      <p>
                        <span className="text-muted-foreground">{wordCopy.root}:</span>{" "}
                        <span className="font-medium">{word.root}</span>
                      </p>
                    )}
                    {word.category && (
                      <p>
                        <span className="text-muted-foreground">{wordCopy.type}:</span>{" "}
                        <span className="font-medium">{wordCopy[word.category]}</span>
                      </p>
                    )}
                  </div>

                  {word.example_ayah && (
                    <div className="mt-4 rounded-lg bg-muted/50 p-3">
                      <p className="text-quran text-right text-sm" dir="rtl" lang="ar">
                        {word.example_ayah}
                      </p>
                      {word.example_reference && (
                        <p className="mt-1 text-xs text-muted-foreground">{word.example_reference}</p>
                      )}
                    </div>
                  )}

                  {word.occurrences && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t("quran.vocabulary.occurrences", { count: word.occurrences })}
                    </p>
                  )}

                  {user && (
                    <Button
                      variant={isSaved ? "outline" : "secondary"}
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => handleToggle(word)}
                      disabled={saveMutation.isPending || seedMutation.isPending}
                    >
                      {isSaved ? vocab.saved : vocab.save}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          </div>

          {words && words.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">{vocab.empty}</p>
          )}
        </section>

        <h2 className="mt-12 font-display text-2xl font-bold">{page.dataTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{page.dataIntro}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.layers.map((layer) => (
            <Card key={layer.name} className="h-full shadow-soft">
              <CardContent className="pt-6">
                <h3 className="font-display text-base font-semibold">{layer.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{layer.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="mt-12 font-display text-2xl font-bold">{page.translationsTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{page.translationsIntro}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="shadow-soft">
            <CardContent className="pt-6 text-sm font-medium">{page.translationEn}</CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="pt-6 text-sm font-medium">{page.translationFr}</CardContent>
          </Card>
        </div>
        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">{page.searchNote}</p>
      </main>
      <SiteFooter />
    </div>
  );
}
