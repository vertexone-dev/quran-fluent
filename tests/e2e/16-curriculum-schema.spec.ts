import { test, expect } from "@playwright/test";

import { createFreshTestUserClient } from "./utils/db";

// Sub-phase 2.1: schema-only coverage. There is no lesson player UI yet, so
// every assertion here talks to Supabase directly (mirroring
// security.spec.ts's RLS-forgery pattern) rather than driving the browser.

test.describe("curriculum schema", () => {
  test("curriculum hierarchy can be read publicly (course -> levels -> modules -> lessons -> sections/exercises)", async ({
    request,
  }) => {
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const headers = { apikey: anonKey };

    const courseRes = await request.get(
      `${url}/rest/v1/courses?select=*&slug=eq.quranic-arabic-foundations`,
      { headers },
    );
    expect(courseRes.ok()).toBe(true);
    const courses = await courseRes.json();
    expect(courses).toHaveLength(1);
    const courseId = courses[0].id;

    const levelsRes = await request.get(
      `${url}/rest/v1/levels?select=*&course_id=eq.${courseId}&order=number.asc`,
      { headers },
    );
    expect(levelsRes.ok()).toBe(true);
    const levels = await levelsRes.json();
    expect(levels).toHaveLength(6);
    const level1Id = levels[0].id;

    const modulesRes = await request.get(
      `${url}/rest/v1/modules?select=*&level_id=eq.${level1Id}&order=order_index.asc`,
      { headers },
    );
    expect(modulesRes.ok()).toBe(true);
    const modules = await modulesRes.json();
    expect(modules).toHaveLength(8);

    const lessonsRes = await request.get(
      `${url}/rest/v1/lessons?select=*,lesson_sections(*),lesson_exercises(*)&module_id=eq.${modules[0].id}`,
      { headers },
    );
    expect(lessonsRes.ok()).toBe(true);
    const lessons = await lessonsRes.json();
    expect(lessons.length).toBeGreaterThanOrEqual(1);
    expect(lessons[0].lesson_sections.length).toBeGreaterThanOrEqual(1);
    expect(lessons[0].lesson_exercises.length).toBeGreaterThanOrEqual(1);
  });

  test("anonymous and authenticated clients cannot mutate curriculum definitions", async ({
    request,
  }) => {
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const { client } = await createFreshTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    expect(session?.access_token).toBeTruthy();

    const forgedCourse = {
      slug: "forged-course",
      title_en: "Forged",
      title_fr: "Falsifié",
    };

    for (const headers of [
      { apikey: anonKey },
      { apikey: anonKey, Authorization: `Bearer ${session!.access_token}` },
    ]) {
      const insertRes = await request.post(`${url}/rest/v1/courses`, {
        headers,
        data: forgedCourse,
      });
      expect(insertRes.ok()).toBe(false);

      const updateRes = await request.patch(
        `${url}/rest/v1/courses?slug=eq.quranic-arabic-foundations`,
        {
          headers: { ...headers, Prefer: "return=representation" },
          data: { title_en: "Hijacked" },
        },
      );
      // Either rejected outright, or accepted but affects zero rows (no
      // write grant means PostgREST may report success with an empty body).
      if (updateRes.ok()) {
        expect(await updateRes.json()).toEqual([]);
      } else {
        expect(updateRes.status()).toBeGreaterThanOrEqual(400);
      }

      const deleteRes = await request.delete(
        `${url}/rest/v1/courses?slug=eq.quranic-arabic-foundations`,
        {
          headers,
        },
      );
      expect(deleteRes.ok()).toBe(false);
    }

    const verifyRes = await request.get(
      `${url}/rest/v1/courses?select=title_en&slug=eq.quranic-arabic-foundations`,
      { headers: { apikey: anonKey } },
    );
    expect((await verifyRes.json())[0].title_en).toBe("Qur'anic Arabic Foundations");
  });

  test("a user cannot read, update, or attempt-log into another user's lesson progress", async ({
    request,
  }) => {
    const { client, userId } = await createFreshTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const forgedUserId = "00000000-0000-0000-0000-000000000000";
    expect(forgedUserId).not.toBe(userId);
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${session!.access_token}`,
      "Content-Type": "application/json",
    };

    for (const table of ["user_lesson_progress", "user_exercise_attempts"]) {
      const selectRes = await request.get(
        `${url}/rest/v1/${table}?select=*&user_id=eq.${forgedUserId}`,
        { headers },
      );
      expect(selectRes.ok()).toBe(true);
      expect(await selectRes.json()).toEqual([]);
    }

    const updateRes = await request.patch(
      `${url}/rest/v1/user_lesson_progress?user_id=eq.${forgedUserId}`,
      {
        headers: { ...headers, Prefer: "return=representation" },
        data: { status: "completed" },
      },
    );
    expect(updateRes.ok()).toBe(true);
    expect(await updateRes.json()).toEqual([]);
  });

  test("Level 1 skeleton exists with the expected shape and ordering", async ({ request }) => {
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const headers = { apikey: anonKey };

    const levelsRes = await request.get(
      `${url}/rest/v1/levels?select=number,slug,order_index,courses(slug)&order=number.asc`,
      { headers },
    );
    const levels = await levelsRes.json();
    expect(levels.map((l: { number: number }) => l.number)).toEqual([1, 2, 3, 4, 5, 6]);
    for (let i = 0; i < levels.length; i++) {
      expect(levels[i].order_index).toBe(i);
    }

    const level1Res = await request.get(`${url}/rest/v1/levels?select=id&number=eq.1`, { headers });
    const level1Id = (await level1Res.json())[0].id;
    const modulesRes = await request.get(
      `${url}/rest/v1/modules?select=slug,order_index&level_id=eq.${level1Id}&order=order_index.asc`,
      { headers },
    );
    const modules = await modulesRes.json();
    expect(modules).toHaveLength(8);
    expect(modules.map((m: { order_index: number }) => m.order_index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  test("an invalid FK on user_lesson_progress is rejected", async ({ request }) => {
    const { client, userId } = await createFreshTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${session!.access_token}`,
      "Content-Type": "application/json",
    };

    const res = await request.post(`${url}/rest/v1/user_lesson_progress`, {
      headers,
      data: { user_id: userId, lesson_id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(409);
  });

  test("a contradictory progress state (completed with no started_at) is rejected", async ({
    request,
  }) => {
    const { client, userId } = await createFreshTestUserClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    const url = process.env.VITE_SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${session!.access_token}`,
      "Content-Type": "application/json",
    };

    const lessonRes = await request.get(
      `${url}/rest/v1/lessons?select=id&slug=eq.schema-validation-placeholder`,
      { headers: { apikey: anonKey } },
    );
    const lessonId = (await lessonRes.json())[0].id;

    const res = await request.post(`${url}/rest/v1/user_lesson_progress`, {
      headers,
      data: {
        user_id: userId,
        lesson_id: lessonId,
        status: "completed",
        started_at: null,
        completed_at: null,
      },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);

    // Clean up in case a partial state was somehow left behind, so this
    // test is safe to re-run.
    await client
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);
  });
});
