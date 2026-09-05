/**
 * Audio playback and speech synthesis service
 */
let currentAudio: HTMLAudioElement | null = null;

export function playAudio(text: string, audioUrl?: string, lang: string = 'en-US') {
  // If there is an audio URL from dictionary API, play that first
  if (audioUrl) {
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      currentAudio = new Audio(audioUrl);
      currentAudio.play().catch(e => {
        console.warn('Direct audio play failed, falling back to TTS:', e);
        speakText(text, lang);
      });
      return;
    } catch {
      // fallback
    }
  }

  // Fallback to Web Speech Synthesis
  speakText(text, lang);
}

export function speakText(text: string, lang: string = 'en-US') {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95; // slightly clear and natural
    utterance.pitch = 1.0;

    // Optional: pick natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(lang.substring(0, 2)) && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Speech synthesis error:', e);
  }
}
