
// A simple, non-exhaustive list of profane words.
// In a real-world application, this would be a more robust library or service.
const profaneWords = [
  'arse', 'ass', 'asshole', 'bastard', 'bitch', 'bollocks', 'bugger', 'bullshit',
  'crap', 'cunt', 'damn', 'dick', 'fag', 'faggot', 'fuck', 'hell', 'homo', 'nigger',
  'piss', 'prick', 'pussy', 'shit', 'slut', 'twat', 'wanker',
  // Add more words as needed, including variations
];

// Create a regex pattern to match any of the words, case-insensitively.
const profanityRegex = new RegExp(`(${profaneWords.join('|')})`, 'i');

export function hasProfanity(text: string): boolean {
  return profanityRegex.test(text);
}
