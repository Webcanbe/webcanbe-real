import Carbon

let source = TISCopyCurrentKeyboardInputSource().takeRetainedValue()
guard let rawIdentifier = TISGetInputSourceProperty(source, kTISPropertyInputSourceID) else {
  fatalError("Current macOS input source has no identifier")
}

let identifier = Unmanaged<CFString>.fromOpaque(rawIdentifier).takeUnretainedValue()
print(identifier as String)
