export const constructChannelPath = (path: string) =>
  `/channels/${path}` as const

export const constructUserPath = (name: string) => `/users/${name}` as const

export const constructMessagesPath = (id: string) => `/messages/${id}` as const

export const constructFilesPath = (id: string) => `/files/${id}` as const

export const constructClipFoldersPath = (id: string) =>
  `/clip-folders/${id}` as const
