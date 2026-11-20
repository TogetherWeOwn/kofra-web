// @kofra/api: the Kofra API client for the web apps. The SDK itself is vendored unchanged from
// the kofra-api repository (vendor/sdk, see vendor/VENDOR.json and scripts/sync.mjs).
export { Kofra, KofraError, paginate } from '../vendor/sdk/index.ts';
export type { CallOptions, ClientOptions, Plan, Problem, components } from '../vendor/sdk/index.ts';

import type { components } from '../vendor/sdk/index.ts';
type S = components['schemas'];
export type Account = S['Account'];
export type Bucket = S['Bucket'];
export type AccessKey = S['AccessKey'];
export type AccessKeyCreated = S['AccessKeyCreated'];
export type Grant = S['Grant'];
export type Usage = S['Usage'];
export type UsageDay = S['UsageDay'];
export type BucketUsage = S['BucketUsage'];
export type ApiEvent = S['Event'];
