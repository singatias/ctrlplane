import type { TargetProviderGoogle } from "@ctrlplane/db/schema";
import type { ClusterManagerClient } from "@google-cloud/container";
import type { google } from "@google-cloud/container/build/protos/protos";
import Container from "@google-cloud/container";
import { CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import { GoogleAuth } from "google-auth-library";
import _ from "lodash";
import { SemVer } from "semver";

import type { UpsertTarget } from "./utils";
import { omitNullUndefined } from "./utils";

const sourceCredentials = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const getGoogleClusterClient = async (targetPrincipal?: string | null) => {
  return new Container.v1.ClusterManagerClient({
    clientOptions:
      targetPrincipal != null
        ? {
            sourceClient: await sourceCredentials.getClient(),
            targetPrincipal,
            lifetime: 3600, // Token lifetime in seconds
            delegates: [],
            targetScopes: ["https://www.googleapis.com/auth/cloud-platform"],
          }
        : {},
  });
};

const getClusters = async (
  clusterClient: ClusterManagerClient,
  projectId: string,
) => {
  const request = { parent: `projects/${projectId}/locations/-` };
  const [response] = await clusterClient.listClusters(request);
  const { clusters } = response;
  return clusters ?? [];
};

const connectToCluster = async (
  clusterClient: ClusterManagerClient,
  project: string,
  clusterName: string,
  clusterLocation: string,
) => {
  const [credentials] = await clusterClient.getCluster({
    name: `projects/${project}/locations/${clusterLocation}/clusters/${clusterName}`,
  });
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromOptions({
    clusters: [
      {
        name: clusterName,
        server: `https://${credentials.endpoint}`,
        caData: credentials.masterAuth!.clusterCaCertificate!,
      },
    ],
    users: [
      {
        name: clusterName,
        token: (await sourceCredentials.getAccessToken())!,
      },
    ],
    contexts: [
      {
        name: clusterName,
        user: clusterName,
        cluster: clusterName,
      },
    ],
    currentContext: clusterName,
  });
  return kubeConfig;
};

const clusterToTarget = (
  workspaceId: string,
  providerId: string,
  project: string,
  cluster: google.container.v1.ICluster,
) => {
  const masterVersion = new SemVer(cluster.currentMasterVersion ?? "0");
  const nodeVersion = new SemVer(cluster.currentNodeVersion ?? "0");
  const autoscaling = String(
    cluster.autoscaling?.enableNodeAutoprovisioning ?? false,
  );

  const appUrl = `https://console.cloud.google.com/kubernetes/clusters/details/${cluster.location}/${cluster.name}/details?project=${project}`;
  return {
    workspaceId,
    name: cluster.name ?? cluster.id ?? "",
    providerId,
    identifier: `${project}/${cluster.name}`,
    version: "kubernetes/v1",
    kind: "KubernetesAPI",
    config: {
      name: cluster.name,
      status: cluster.status,
      cluster: {
        certificateAuthorityData: cluster.masterAuth?.clusterCaCertificate,
        endpoint: `https://${cluster.endpoint}`,
      },
    },
    labels: omitNullUndefined({
      "ctrlplane/url": appUrl,

      "google/self-link": cluster.selfLink,
      "google/project": project,
      "google/location": cluster.location,
      "google/autopilot": cluster.autopilot?.enabled,

      "kubernetes/cluster-name": cluster.name,
      "kubernetes/cluster-id": cluster.id,
      "kubernetes/distribution": "gke",
      "kubernetes/status": cluster.status,
      "kubernetes/node-count": String(cluster.currentNodeCount ?? "unknown"),

      "kubernetes/master-version": masterVersion.version,
      "kubernetes/master-version-major": String(masterVersion.major),
      "kubernetes/master-version-minor": String(masterVersion.minor),
      "kubernetes/master-version-patch": String(masterVersion.patch),

      "kubernetes/node-version": nodeVersion.version,
      "kubernetes/node-version-major": String(nodeVersion.major),
      "kubernetes/node-version-minor": String(nodeVersion.minor),
      "kubernetes/node-version-patch": String(nodeVersion.patch),

      "kubernetes/autoscaling-enabled": autoscaling,

      ...(cluster.resourceLabels ?? {}),
    }),
  };
};

export const getGkeTargets = async (
  workspaceId: string,
  config: TargetProviderGoogle,
  serviceAccountEmail: string | null,
) => {
  const googleClusterClient = await getGoogleClusterClient(serviceAccountEmail);

  const clusters = (
    await Promise.allSettled(
      config.projectIds.map(async (project) => {
        const clusters = await getClusters(googleClusterClient, project);
        return { project, clusters };
      }),
    )
  )
    .filter((result) => result.status === "fulfilled")
    .map((v) => v.value);

  const kubernetesApiTargets: UpsertTarget[] = clusters
    .map(({ project, clusters }) =>
      clusters.map((cluster) =>
        clusterToTarget(workspaceId, config.targetProviderId, project, cluster),
      ),
    )
    .flat();

  const kubernetesNamespaceTargets = (
    await Promise.all(
      clusters.flatMap(({ project, clusters }) => {
        return clusters.flatMap(async (cluster) => {
          if (cluster.name == null || cluster.location == null) return [];
          const kubeConfig = await connectToCluster(
            googleClusterClient,
            project,
            cluster.name,
            cluster.location,
          );

          const k8sApi = kubeConfig.makeApiClient(CoreV1Api);
          try {
            const response = await k8sApi.listNamespace();
            const namespaces = response.body.items;
            return namespaces
              .filter((n) => n.metadata != null)
              .map((n) =>
                _.merge(
                  clusterToTarget(
                    workspaceId,
                    config.targetProviderId,
                    project,
                    cluster,
                  ),
                  {
                    name: `${cluster.name ?? cluster.id ?? ""}/${n.metadata!.name}`,
                    kind: "KubernetesNamespace",
                    identifier: `${project}/${cluster.name}/${n.metadata!.name}`,
                    config: {
                      namespace: n.metadata!.name,
                    },
                    labels: {
                      ...n.metadata?.labels,
                      "kubernetes/namespace": n.metadata!.name,
                    },
                  },
                ),
              );
          } catch {
            console.log(
              `Unable to connect to cluster: ${cluster.name}/${cluster.id}`,
            );
            return [];
          }
        });
      }),
    )
  ).flat();

  return [...kubernetesApiTargets, ...kubernetesNamespaceTargets];
};
