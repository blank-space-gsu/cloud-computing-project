import { describe, expect, it, vi } from "vitest";
import {
  listAccessibleTeams,
  listMembersForAccessibleTeam
} from "../../../src/repositories/team.repository.js";

describe("team repository", () => {
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
});
