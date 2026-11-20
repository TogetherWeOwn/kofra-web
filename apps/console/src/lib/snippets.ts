// Copy-ready configuration for a new access key. Built in the browser's page only, from the
// one response that holds the secret; nothing here is stored.

export interface KeyMaterial {
	id: string;
	secret: string;
	endpoint: string;
}

export const REGION = 'auto';

export function envLines(k: KeyMaterial): string {
	return [
		`AWS_ACCESS_KEY_ID=${k.id}`,
		`AWS_SECRET_ACCESS_KEY=${k.secret}`,
		`AWS_ENDPOINT_URL=${k.endpoint}`,
		`AWS_REGION=${REGION}`
	].join('\n');
}

export function rcloneConfig(k: KeyMaterial, remote = 'kofra'): string {
	return [
		`[${remote}]`,
		'type = s3',
		'provider = Other',
		`access_key_id = ${k.id}`,
		`secret_access_key = ${k.secret}`,
		`endpoint = ${k.endpoint}`,
		`region = ${REGION}`
	].join('\n');
}

export function awsCliCommands(k: KeyMaterial, profile = 'kofra'): string {
	return [
		`aws configure set aws_access_key_id ${k.id} --profile ${profile}`,
		`aws configure set aws_secret_access_key ${k.secret} --profile ${profile}`,
		`aws configure set region ${REGION} --profile ${profile}`,
		`aws configure set endpoint_url ${k.endpoint} --profile ${profile}`,
		`aws s3 ls --profile ${profile}`
	].join('\n');
}
