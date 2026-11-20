import { describe, expect, it } from 'vitest';
import { awsCliCommands, envLines, rcloneConfig } from './snippets.js';

const k = {
	id: 'KFABCDEFGHJKLMNP',
	secret: 'EXAMPLEsecretEXAMPLEsecretEXAMPLE0000000',
	endpoint: 'https://s3.kofra.io'
};

describe('key snippets', () => {
	it('builds environment lines', () => {
		expect(envLines(k)).toBe(
			'AWS_ACCESS_KEY_ID=KFABCDEFGHJKLMNP\nAWS_SECRET_ACCESS_KEY=EXAMPLEsecretEXAMPLEsecretEXAMPLE0000000\nAWS_ENDPOINT_URL=https://s3.kofra.io\nAWS_REGION=auto'
		);
	});
	it('builds an rclone remote and aws-cli profile', () => {
		expect(rcloneConfig(k)).toContain('[kofra]\ntype = s3\nprovider = Other');
		expect(rcloneConfig(k)).toContain('endpoint = https://s3.kofra.io');
		expect(rcloneConfig(k)).toContain('force_path_style = true');
		expect(awsCliCommands(k).split('\n')).toHaveLength(6);
		expect(awsCliCommands(k)).toContain('s3.addressing_style path');
		expect(awsCliCommands(k)).toContain('endpoint_url https://s3.kofra.io');
	});
});
