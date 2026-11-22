export const scopeGroups = [
	{
		label: 'Read',
		scopes: {
			'account:read': 'View workspace details',
			'buckets:read': 'View buckets',
			'keys:read': 'View access keys',
			'tokens:read': 'View API tokens',
			'usage:read': 'View usage',
			'events:read': 'View workspace activity',
			'audit:read': 'View audit history',
			'objects:read': 'View file information'
		}
	},
	{
		label: 'Change',
		scopes: {
			'buckets:write': 'Create and change buckets',
			'keys:write': 'Create and change access keys',
			'tokens:write': 'Create and change API tokens'
		}
	},
	{
		label: 'Delete',
		scopes: {
			'buckets:delete': 'Delete buckets',
			'account:delete': 'Request workspace deletion'
		}
	}
];
