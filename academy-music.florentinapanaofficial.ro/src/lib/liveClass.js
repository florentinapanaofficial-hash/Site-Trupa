export function classConfig(role) {
    const inspector = role === 'inspector';
    return {
        prejoinConfig: { enabled: false },
        disableInitialGUM: inspector,
        startAudioMuted: inspector,
        startVideoMuted: inspector,
        startWithAudioMuted: inspector,
        startWithVideoMuted: inspector,
        disableShortcuts: inspector,
        disableAEC: true,
        disableNS: true,
        disableAGC: true,
        disableAP: true,
        enableNoisyMicDetection: false,
        audioQuality: { stereo: true, opusMaxAverageBitrate: 128000, enableOpusDtx: false },
        constraints: { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } },
        lobby: { autoKnock: true, enableChat: false },
        securityUi: { hideLobbyButton: true, disableLobbyPassword: true },
        disableInviteFunctions: true,
        remoteVideoMenu: { disableGrantModerator: true },
        deeplinking: { disabled: true },
        toolbarButtons: inspector ? ['tileview', 'fullscreen', 'hangup'] : ['microphone', 'camera', 'desktop', 'participants-pane', 'tileview', 'fullscreen', 'hangup'],
        hiddenPremeetingButtons: inspector ? ['microphone', 'camera', 'settings', 'select-background', 'invite'] : [],
    };
}