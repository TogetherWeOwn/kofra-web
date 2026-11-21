// S3 compatibility reference: what the API supports today, its limits and its errors.
// Keep this page true to the service as deployed; it is what tools and AI assistants rely on.
import type { Block } from '#lib/blocks.js';
import { ENDPOINT, ENDPOINT_HOST, PROFILE, REGION } from '#lib/content.js';
import { EARLY_NOTE } from '#lib/pages/docs.js';

export const S3 = {
	heading: 'S3 compatibility',
	description: `Which S3 API operations Kofra supports, its limits and its error codes. Endpoint ${ENDPOINT}, region ${REGION}, path-style requests, Signature Version 4.`,
	lead: 'What the Kofra S3 API supports today, its limits, and what its errors mean.'
};

export const S3_BLOCKS: Block[] = [
	...EARLY_NOTE,
	{
		type: 'p',
		text: 'This page describes the API as it works today. It is updated as operations are added.'
	},
	{ type: 'h2', text: 'Endpoint and signing', id: 'endpoint' },
	{
		type: 'dl',
		items: [
			['Endpoint', `\`${ENDPOINT}\` (HTTPS only)`],
			[
				'Region',
				`\`${REGION}\` (\`us-east-1\` is also accepted). Requests signed for any other region are refused with \`AuthorizationHeaderMalformed\` (\`AuthorizationQueryParametersError\` for a presigned URL).`
			],
			[
				'Addressing',
				`Path-style only: \`${ENDPOINT}/my-bucket/path/to/file\`. Virtual-hosted style (\`my-bucket.${ENDPOINT_HOST}\`) is refused.`
			],
			['Signing', 'AWS Signature Version 4, in the `Authorization` header or as a presigned URL.']
		]
	},

	{ type: 'h2', text: 'Supported operations', id: 'operations' },
	{
		type: 'table',
		caption: 'S3 operations and their support',
		head: ['Operation', 'Support', 'Notes'],
		rows: [
			['ListBuckets', 'Yes', ''],
			['HeadBucket, GetBucketLocation', 'Yes', `The location is \`${REGION}\`.`],
			['CreateBucket, DeleteBucket', 'No', 'Create and delete buckets in the Kofra console.'],
			['ListObjectsV2, ListObjects', 'Yes', 'Prefix, delimiter and pagination.'],
			[
				'PutObject',
				'Yes',
				`Up to ${PROFILE.maxRequestMiB} MiB per request; use a multipart upload above that.`
			],
			[
				'GetObject',
				'Yes',
				'One byte range per request. Conditional headers: `If-Match`, `If-None-Match`, `If-Modified-Since`, `If-Unmodified-Since`.'
			],
			['HeadObject', 'Yes', ''],
			['DeleteObject, DeleteObjects', 'Yes', ''],
			['CopyObject', 'Partly', 'Within the same bucket.'],
			[
				'Conditional PutObject',
				'Partly',
				'`If-None-Match: *` (write only if the key does not exist) and `If-Match` with one ETag.'
			],
			[
				'CreateMultipartUpload, UploadPart, CompleteMultipartUpload, AbortMultipartUpload',
				'Yes',
				''
			],
			['ListParts, ListMultipartUploads', 'Yes', ''],
			['UploadPartCopy', 'Partly', 'Within the same bucket.'],
			['Presigned URLs', 'Yes', 'Query-string Signature Version 4, valid for up to 7 days.'],
			[
				'Object tagging, versioning, lifecycle, CORS, ACLs, bucket policies, Object Lock',
				'Not yet',
				'Requests return `NotImplemented` (501).'
			]
		]
	},

	{ type: 'h2', text: 'Limits', id: 'limits' },
	{
		type: 'table',
		caption: 'Request and upload limits',
		head: ['Limit', 'Value', 'Notes'],
		rows: [
			[
				'One request body (PutObject or UploadPart)',
				`${PROFILE.maxRequestMiB} MiB`,
				'Larger bodies are refused with `EntityTooLarge`, or with HTTP 413 above 100 MiB.'
			],
			['Parts in one multipart upload', '10,000', ''],
			[
				'Part size',
				`5 MiB to ${PROFILE.maxRequestMiB} MiB`,
				`The last part may be smaller than 5 MiB. ${PROFILE.partMiB} MiB is recommended.`
			],
			[
				'Largest object',
				`${PROFILE.maxObjectGiB} GiB`,
				`With ${PROFILE.partMiB} MiB parts. With parts above ${PROFILE.partMiB} MiB: ${PROFILE.maxObjectLargePartsGiB} GiB. With 5 MiB parts: ${PROFILE.maxObjectSmallPartsGiB} GiB.`
			],
			['Presigned URL lifetime', '7 days', '`X-Amz-Expires` up to 604800.'],
			['Byte ranges per GET', '1', 'A request for several ranges returns `InvalidRequest`.']
		]
	},
	{
		type: 'p',
		text: `Tool defaults: aws-cli and restic work as they are. rclone needs a lower \`upload_cutoff\`, because its default single-upload cutoff is 200 MiB. For speed and the largest objects, use ${PROFILE.partMiB} MiB parts and about ${PROFILE.concurrency} requests at once: see the [recommended settings](/docs#recommended).`
	},

	{ type: 'h2', text: 'Error codes', id: 'errors' },
	{
		type: 'p',
		text: 'Errors use the standard S3 XML error body with a `Code`, a `Message` and a `RequestId`. Quote the request ID when you contact support.'
	},
	{
		type: 'table',
		caption: 'Common error codes and what to do',
		head: ['Code', 'HTTP', 'Meaning and fix'],
		rows: [
			[
				'AccessDenied',
				'403',
				'The key may not do this operation, for example a write with a read-only key.'
			],
			[
				'AuthorizationHeaderMalformed, AuthorizationQueryParametersError',
				'400',
				`The request is signed for the wrong region. Use \`${REGION}\`.`
			],
			['InvalidAccessKeyId', '403', 'The access key ID does not exist or was revoked.'],
			[
				'SignatureDoesNotMatch',
				'403',
				'The secret key is wrong, or something changed the request after it was signed.'
			],
			['RequestTimeTooSkewed', '403', 'Your computer’s clock is wrong. Synchronise it and retry.'],
			['NoSuchBucket', '404', 'The bucket does not exist, or belongs to another account.'],
			['NoSuchKey', '404', 'No object has that key.'],
			['NoSuchUpload', '404', 'The multipart upload ID is unknown, completed or aborted.'],
			['MethodNotAllowed', '405', 'The HTTP method is not allowed on this resource.'],
			['BucketNotEmpty', '409', 'Delete the objects first.'],
			[
				'ConditionalRequestConflict',
				'409',
				'Another conditional write to the same key was in progress. Retry.'
			],
			['PreconditionFailed', '412', 'An `If-Match` or `If-None-Match` condition was not met.'],
			['InvalidRange', '416', 'The byte range starts beyond the end of the object.'],
			[
				'EntityTooLarge',
				'400',
				`The body is over ${PROFILE.maxRequestMiB} MiB, or the object would exceed its limits. Use a multipart upload, with ${PROFILE.partMiB} MiB parts.`
			],
			['EntityTooSmall', '400', 'A part other than the last is smaller than 5 MiB.'],
			[
				'BadDigest',
				'400',
				'The body does not match its checksum, so it was damaged on the way. Retry the upload.'
			],
			[
				'InvalidArgument, InvalidRequest, MalformedXML',
				'400',
				'The request is malformed or uses an unsupported combination of options. A virtual-hosted-style request (bucket in the host name) is refused this way: use path-style.'
			],
			[
				'NotImplemented',
				'501',
				'The operation or option is not supported yet. See the table above.'
			],
			[
				'InternalError',
				'500',
				'Retry with backoff. If it persists, contact support with the request ID.'
			],
			[
				'SlowDown, ServiceUnavailable',
				'503',
				'Retry with exponential backoff. Most S3 tools do this automatically.'
			]
		]
	}
];
