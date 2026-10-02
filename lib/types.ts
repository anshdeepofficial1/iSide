export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type ShortClip = {
  id: string;
  title: string;
  start: number;
  end: number;
  reason: string;
  socialCaption: string;
  score: number;
  renderedUrl?: string;
};

export type LatestVideo = {
  channelId: string;
  channelTitle: string;
  videoId: string;
  title: string;
  url: string;
  thumbnail: string;
  published: string;
};
