import { resolveNativeBlockKey, getPolicyPackageKey } from '../policyMapper';

describe('resolveNativeBlockKey', () => {
  it('prefixes website policies with "website:" so BLOCK_APP matches the native timer key', () => {
    const policy = {
      target_type: 'website',
      app_name: 'daraz.pk',
      package_name: 'daraz.pk',
      packageName: 'daraz.pk',
    } as any;
    expect(resolveNativeBlockKey(policy)).toBe('website:daraz.pk');
  });

  it('strips protocol/www and lowercases the website domain', () => {
    const policy = {
      target_type: 'website',
      app_name: 'HTTPS://www.Daraz.pk/some/path',
      package_name: '',
      packageName: '',
    } as any;
    expect(resolveNativeBlockKey(policy)).toBe('website:daraz.pk');
  });

  it('leaves app package names unchanged', () => {
    const policy = {
      target_type: 'app',
      app_name: 'com.whatsapp',
      package_name: 'com.whatsapp',
      packageName: 'com.whatsapp',
    } as any;
    expect(resolveNativeBlockKey(policy)).toBe('com.whatsapp');
  });

  it('does not double-prefix an already-prefixed website key', () => {
    const policy = {
      target_type: 'website',
      app_name: 'website:daraz.pk',
      package_name: '',
      packageName: '',
    } as any;
    expect(resolveNativeBlockKey(policy)).toBe('website:daraz.pk');
  });

  it('returns null when there is no usable identifier', () => {
    const policy = {
      target_type: 'website',
      app_name: '',
      package_name: '',
      packageName: '',
    } as any;
    expect(resolveNativeBlockKey(policy)).toBeNull();
  });

  it('matches the exact key websites are stored/looked up under elsewhere', () => {
    // The block key must equal getPolicyPackageKey — the same function used by
    // selectPolicyState / useUsageReporter — or the block, the live-lock match,
    // and the unblock-reset would key three different native entries.
    const policy = { target_type: 'website', app_name: 'daraz.pk' } as any;
    expect(resolveNativeBlockKey(policy)).toBe(getPolicyPackageKey(policy));
  });
});
