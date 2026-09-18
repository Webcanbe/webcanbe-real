# Threat model — final P05 regression expectation cleanup

The only changed surface is a test file. The reviewed invariant is that accepting
the exact frozen Redux Berry graph and recognizing the exact Todo Bun binary lock
must not weaken rejection of malformed, tampered, substituted, untrusted, or
unsupported lock data. Production parsers, profile selection, graph normalization,
archive handling, package execution policy, and runtime code are unchanged.

The relevant abuse cases are forged package identity, missing operator integrity,
malformed cache checksum, virtual-locator substitution, uploaded patch/workspace/
file/git protocols, invalid Bun lengths and indices, non-npm registry resolution,
invalid SRI, extension bytes, and a root manifest that does not match the lock.
