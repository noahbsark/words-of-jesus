(() => {
  'use strict';
  const notes = {
    "john:3": [
      [1, 1, "Narration"],
      [2, 2, "Other speaker", "Nicodemus speaks after the narrator introduces his visit."],
      [3, 3, "Jesus and narration"],
      [4, 4, "Other speaker", "Nicodemus asks the question."],
      [5, 5, "Jesus and narration"],
      [6, 8, "Jesus speaks"],
      [9, 9, "Other speaker", "Nicodemus speaks."],
      [10, 10, "Jesus and narration"],
      [11, 15, "Jesus speaks"],
      [16, 21, "Speaker boundary varies", "Editions differ on where Jesus’ speech ends and the narrator’s explanation begins."]
    ],
    "john:8": [
      [1, 3, "Narration"],
      [4, 5, "Other speaker", "The accusers put their question to Jesus."],
      [6, 6, "Narration"],
      [7, 7, "Jesus and narration"],
      [8, 9, "Narration"],
      [10, 10, "Jesus and narration"],
      [11, 11, "The woman and Jesus", "The woman answers first. Jesus’ reply follows in the same verse."],
      [12, 12, "Jesus and narration"]
    ],
    "john:13": [
      [6, 6, "Other speaker", "Peter asks about the foot washing."],
      [7, 7, "Jesus and narration"],
      [8, 8, "Peter and Jesus", "Peter speaks before Jesus answers."],
      [9, 9, "Other speaker", "Peter continues the exchange."],
      [10, 10, "Jesus and narration"],
      [11, 11, "Jesus is quoted", "The narrator explains the earlier statement and repeats part of what Jesus said."],
      [12, 12, "Jesus and narration"],
      [13, 17, "Jesus speaks"]
    ],
    "john:20": [
      [11, 12, "Narration"],
      [13, 13, "Angels and Mary", "The angels ask the first question to Mary. Jesus asks a similar question in verse 15."],
      [14, 14, "Narration"],
      [15, 16, "Jesus and Mary", "Read both turns. Mary’s words are distinct from Jesus’ question or address."],
      [17, 17, "Jesus and narration"],
      [18, 18, "Narration"],
      [19, 19, "Jesus and narration"],
      [20, 20, "Narration"],
      [21, 22, "Jesus and narration"],
      [23, 23, "Jesus speaks"],
      [24, 24, "Narration"],
      [25, 25, "The disciples and Thomas"],
      [26, 27, "Jesus and narration"],
      [28, 28, "Other speaker", "Thomas speaks to Jesus."],
      [29, 29, "Jesus and narration"]
    ],
    "luke:10": [
      [25, 25, "Other speaker", "The lawyer opens the exchange."],
      [26, 26, "Jesus and narration"],
      [27, 27, "Other speaker", "The lawyer gives this summary of the law."],
      [28, 28, "Jesus and narration"],
      [29, 29, "Other speaker", "The lawyer asks who his neighbor is."],
      [30, 30, "Jesus and narration"],
      [31, 34, "Jesus speaks"],
      [35, 35, "Speech within a parable", "Jesus tells the story. The instruction to the innkeeper is spoken by the Samaritan inside it."],
      [36, 36, "Jesus speaks"],
      [37, 37, "The lawyer and Jesus", "The lawyer answers first. Jesus gives the closing instruction."]
    ],
    "luke:23": [
      [32, 33, "Narration"],
      [34, 34, "Jesus and narration", "The prayer appears in the KJV. Manuscripts and editions differ. The casting of lots is narration."],
      [35, 35, "Other speaker", "Luke introduces the rulers’ speech."],
      [36, 36, "Narration"],
      [37, 37, "Other speaker", "The soldiers speak."],
      [38, 38, "Inscription"],
      [39, 42, "Other speaker", "These lines belong to the two men crucified beside Jesus."],
      [43, 43, "Jesus and narration"],
      [44, 45, "Narration"],
      [46, 46, "Jesus and narration"]
    ],
    "mark:16": [
      [8, 8, "Narration"],
      [9, 14, "Narration", "These verses are in the longer ending of Mark."],
      [15, 15, "Jesus and narration", "This commission appears in the longer ending. See translation footnotes for how editions present it."],
      [16, 18, "Jesus speaks"],
      [19, 20, "Narration"]
    ],
    "acts:20": [
      [35, 35, "Jesus is quoted", "Paul quotes Jesus within his speech. The original occasion is unspecified."]
    ],
    "matthew:27": [
      [62, 62, "Narration"],
      [63, 63, "Jesus is quoted", "The chief priests and Pharisees report the prediction to Pilate."],
      [64, 64, "Other speaker", "The chief priests and Pharisees continue their request."]
    ],
    "revelation:1": [
      [8, 8, "The Lord, the Almighty", "This is the title the verse itself gives the speaker."],
      [9, 10, "Narration"],
      [11, 11, "Voice in the vision", "The KJV includes an opening title that some editions omit."],
      [12, 16, "Narration"],
      [17, 17, "Jesus and narration", "John describes the encounter before the voice speaks."],
      [18, 20, "Jesus speaks", "The speaker identifies himself as one who died and lives."]
    ],
    "revelation:21": [
      [5, 8, "The one on the throne", "The passage introduces this speaker in verse 5."]
    ],
    "revelation:22": [
      [12, 15, "Speaker boundary varies", "Several voices appear near the book’s close. Verse 16 identifies Jesus explicitly."],
      [16, 16, "Jesus speaks"],
      [17, 17, "The Spirit and the bride", "The invitation also includes the person who hears."],
      [18, 19, "Speaker boundary varies", "Read through verse 20 for the change of voice."],
      [20, 20, "Promise and reply", "The promise is followed by the response asking Jesus to come."],
      [21, 21, "Closing blessing"]
    ]
  };
  function get(book, chapter, verse, selectionStart) {
    const match = notes[book + ':' + chapter]?.find(([start, end]) => verse >= start && verse <= end);
    if (!match) return null;
    const [start, , label, detail] = match;
    return {label, detail: verse === start || verse === selectionStart ? detail : undefined};
  }
  window.BibleSpeakerNotes = {get};
})();
