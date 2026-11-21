<script lang="ts">
	import { page } from '$app/state';
	import Profile from '#lib/components/account/Profile.svelte';
	import Email from '#lib/components/account/Email.svelte';
	import Passkeys from '#lib/components/account/Passkeys.svelte';
	import Password from '#lib/components/account/Password.svelte';
	import TwoStep from '#lib/components/account/TwoStep.svelte';
	import Recovery from '#lib/components/account/Recovery.svelte';
	import Devices from '#lib/components/account/Devices.svelte';
	import SecurityLog from '#lib/components/account/SecurityLog.svelte';

	let { data, form } = $props();
	const user = $derived(data.user);
</script>

<svelte:head><title>Account: Kofra console</title></svelte:head>
<div class="ph"><h1>Account</h1></div>
<Profile name={user.name} csrf={data.csrf} result={form?.section === 'profile' ? form : null} />
<Email
	email={user.email}
	verified={user.email_verified}
	csrf={data.csrf}
	result={form?.section === 'email' ? form : null}
/>
<Password
	passwordOptional={data.passwordOptional}
	changed={page.url.searchParams.get('password') === 'changed'}
	csrf={data.csrf}
	result={form?.section === 'password' ? form : null}
/>
<TwoStep
	enabled={user.totp}
	hasPasskeys={user.passkeys > 0}
	disable={data.disable}
	csrf={data.csrf}
	result={form?.section.startsWith('totp') ? form : null}
/>
<Passkeys
	passkeys={data.passkeys}
	defaultName={data.defaultPasskeyName}
	removeId={data.removePasskey}
	needsPassword={!user.totp && user.passkeys === 0}
	codesReplaced={!!form &&
		!form.problem &&
		(form.section === 'recovery' ||
			(form.section === 'totpConfirm' && !!form.codes) ||
			form.section === 'totpDisable')}
	csrf={data.csrf}
	result={form?.section === 'renamePasskey' || form?.section === 'removePasskey' ? form : null}
/>
<Recovery
	enabled={user.totp || user.passkeys > 0}
	count={user.recovery_codes_left}
	csrf={data.csrf}
	result={form?.section === 'recovery' ? form : null}
/>
<Devices
	sessions={data.sessions}
	csrf={data.csrf}
	result={form?.section.startsWith('revoke') ? form : null}
/>
<SecurityLog events={data.security} />
