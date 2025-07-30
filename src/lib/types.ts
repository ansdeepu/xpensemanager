export type AppFile = {
  id: string;
  name: string;
  content: string;
  language: 'typescript' | 'css' | 'json' | 'plaintext';
};
