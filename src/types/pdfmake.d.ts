declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    addVirtualFileSystem?: (vfs: Record<string, string>) => void;
    vfs?: Record<string, string>;
    createPdf: (documentDefinition: unknown) => {
      getBlob: {
        (): Promise<Blob>;
        (callback: (blob: Blob) => void): void;
      };
    };
  };

  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const fonts: Record<string, string> | { pdfMake?: { vfs?: Record<string, string> } };
  export default fonts;
}
