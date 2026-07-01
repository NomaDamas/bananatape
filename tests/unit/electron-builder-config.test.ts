import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('electron-builder Linux package metadata', () => {
  it('provides maintainer metadata for deb packages', () => {
    // Given: Linux deb packaging requires a maintainer email.
    const packageJson = fs.readFileSync('package.json', 'utf8');
    const builderConfig = fs.readFileSync('electron-builder.yml', 'utf8');

    // When: electron-builder resolves metadata from package.json or linux options.
    const packageAuthorHasEmail = /"author"\s*:\s*(?:"[^"]+<[^<>@\s]+@[^<>@\s]+>"|\{[\s\S]*"email"\s*:)/.test(packageJson);
    const linuxConfigHasMaintainer = /^\s*maintainer:\s*.+@.+$/m.test(builderConfig);

    // Then: the deb target has maintainer metadata and does not fail at packaging time.
    expect(packageAuthorHasEmail || linuxConfigHasMaintainer).toBe(true);
  });

  it('excludes previous Electron build output from standalone resources', () => {
    // Given: electron-builder copies .next/standalone into app resources.
    const builderConfig = fs.readFileSync('electron-builder.yml', 'utf8');

    // When: a previous packaging run left dist-electron output in the workspace.
    const excludesElectronOutput = /^\s*-\s+"!dist-electron\/\*\*"$/m.test(builderConfig);

    // Then: the packaged app cannot recursively include an older packaged app.
    expect(excludesElectronOutput).toBe(true);
  });

  it('does not auto-discover a local macOS signing identity for unsigned packages', () => {
    // Given: local developer machines may have inaccessible or unrelated signing identities.
    const builderConfig = fs.readFileSync('electron-builder.yml', 'utf8');

    // Then: local macOS packaging stays deterministic and does not fail during codesign.
    expect(builderConfig).toMatch(/^\s*identity:\s*null$/m);
  });
});
