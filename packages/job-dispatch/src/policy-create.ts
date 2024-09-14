import type { Tx } from "@ctrlplane/db";
import type { JobConfig } from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull } from "@ctrlplane/db";
import {
  environment,
  environmentPolicy,
  environmentPolicyApproval,
  release,
  releaseJobTrigger,
} from "@ctrlplane/db/schema";

export const createJobExecutionApprovals = async (
  db: Tx,
  jobConfigs: JobConfig[],
) => {
  const policiesToCheck = await db
    .selectDistinctOn([release.id, environmentPolicy.id])
    .from(releaseJobTrigger)
    .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(
      environmentPolicy,
      and(
        isNull(environment.deletedAt),
        eq(environment.policyId, environmentPolicy.id),
        eq(environmentPolicy.approvalRequirement, "manual"),
      ),
    )
    .where(
      inArray(release.id, jobConfigs.map((t) => t.releaseId).filter(isPresent)),
    );

  if (policiesToCheck.length === 0) return;

  await db.insert(environmentPolicyApproval).values(
    policiesToCheck.map((p) => ({
      policyId: p.environment_policy.id,
      releaseId: p.release.id,
    })),
  );
};
