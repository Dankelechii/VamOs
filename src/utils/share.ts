import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

/**
 * Share a photo through the native share sheet (Instagram is one of the apps the
 * OS offers there — direct posting via Instagram's API requires a verified
 * business account and server-side OAuth, which isn't something a client-only
 * prototype can do, so the share sheet is the realistic "post to Instagram" path).
 */
export async function shareToInstagram(uri: string) {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert("Sharing unavailable", "Sharing isn't supported on this device.");
      return;
    }

    let localUri = uri;
    if (/^https?:\/\//.test(uri)) {
      const downloaded = await File.downloadFileAsync(uri, Paths.cache);
      localUri = downloaded.uri;
    }

    await Sharing.shareAsync(localUri, {
      dialogTitle: "Share to Instagram",
      mimeType: "image/jpeg",
    });
  } catch (e) {
    Alert.alert("Couldn't share photo", "Something went wrong preparing this photo to share.");
  }
}
