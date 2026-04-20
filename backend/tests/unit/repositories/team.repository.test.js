import { describe, expect, it, vi } from "vitest";
import {
  createTeamRecord,
  listAccessibleTeams,
  listMembersForAccessibleTeam,
  updateTeamById
} from "../../../src/repositories/team.repository.js";

describe("team repository", () => {
  it("creates teams without relying on name-based upsert behavior", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: "team-1" }]
      })
    };

    const result = await createTeamRecord(
      {
        name: "IT Team",
        description: "Shared support queue"
      },
      { pool }
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).not.toContain("on conflict");
    expect(values).toEqual(["IT Team", "Shared support queue"]);
    expect(result).toBe("team-1");
  });

  it("filters accessible team summaries to active memberships", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "team-1",
            name: "Operations Team",
            description: "Demo team",
            membership_role: "manager",
            membership_status: "active",
            member_count: "3",
            manager_count: "1",
            created_at: "2026-04-17T00:00:00.000Z",
            updated_at: "2026-04-17T00:00:00.000Z"
          }
        ]
      })
    };

    const result = await listAccessibleTeams(
      {
        requestingUserId: "user-1",
        isAdmin: false
      },
      { pool }
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain("viewer.membership_status = 'active'");
    expect(sql).toContain("tm.membership_status = 'active'");
    expect(result[0].memberCount).toBe(3);
  });

  it("defaults team roster queries to active memberships", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "user-1",
            email: "employee.one@cloudcomputing.local",
            first_name: "Ethan",
            last_name: "Employee",
            job_title: "Specialist",
            avatar_url: null,
            app_role: "employee",
            is_active: true,
            membership_role: "member",
            membership_status: "active",
            joined_at: "2026-04-17T00:00:00.000Z",
            left_at: null,
            removed_at: null,
            last_rejoined_at: null
          }
        ]
      })
    };

    const result = await listMembersForAccessibleTeam(
      {
        teamId: "team-1"
      },
      { pool }
    );

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).toContain("tm.membership_status = $2");
    expect(values).toEqual(["team-1", "active"]);
    expect(result[0].membershipStatus).toBe("active");
  });

  it("updates team records without assuming names are unique", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: "team-1" }]
      })
    };

    const result = await updateTeamById(
      "team-1",
      {
        name: "IT Team",
        description: "Operations support"
      },
      { pool }
    );

    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).toContain("update public.teams");
    expect(sql).not.toContain("on conflict");
    expect(values).toEqual(["IT Team", "Operations support", "team-1"]);
    expect(result).toBe("team-1");
  });
});
