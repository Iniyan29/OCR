import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import vision from "@react-native-ml-kit/text-recognition";
import AsyncStorage from "@react-native-async-storage/async-storage";

const parseOcrData = (text: string) => {
  if (!text)
    return {
      name: "",
      fatherName: "",
      idNumber: "",
      dob: "",
      confidence: { name: "", fatherName: "", idNumber: "", dob: "" },
    };

  const mockConfidence = () => (Math.random() * 0.1 + 0.9).toFixed(2);

  const cleanText = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  let idNumber = "";
  const panMatch = cleanText.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  const aadharMatch = cleanText.match(/\b(\d{4}\s?\d{4}\s?\d{4})\b/);
  const voterMatch = cleanText.match(/([A-Z]{3})\s*(\d{7})/i);

  if (panMatch) {
    console.log(panMatch, "PAN Match");

    idNumber = panMatch[1];
  } else if (aadharMatch) {
    console.log(aadharMatch, "Aadhar Match");

    idNumber = aadharMatch[1].replace(/\s/g, "");
  } else if (voterMatch) {
    console.log(voterMatch, "Voter Match");

    idNumber = (voterMatch[1] + voterMatch[2]).toUpperCase();
    console.log(voterMatch, "Voter ID Match");
  }

  let name = "";
  if (panMatch && idNumber) {
    let beforeId = cleanText.split(idNumber)[0];

    const noiseWords = ["PERMANENT", "ACCOUNT", "NUMBER", "CARD", "ZTI"];
    noiseWords.forEach((word) => {
      const regex = new RegExp(word, "gi");
      beforeId = beforeId.replace(regex, "");
    });

    beforeId = beforeId.replace(/[^A-Za-z\s]/g, "").trim();

    const nameParts = beforeId.split(/\s+/);
    name = nameParts.slice(-1).join(" ");
  } else {
    const nameMatch = cleanText.match(
      /(?:^|[^A-Za-z])(Name)\s*[:\-]?\s*([A-Za-z]+)/i
    );
    if (nameMatch) name = nameMatch[2].trim();
  }

  const dobMatch = cleanText.match(/\b(\d{2}[\/-]\d{2}[\/-]\d{4})\b/);
  const dob = dobMatch ? dobMatch[1] : "";

  return {
    name,

    idNumber,
    dob,
    confidence: {
      name: mockConfidence(),
      fatherName: mockConfidence(),
      idNumber: mockConfidence(),
      dob: mockConfidence(),
    },
  };
};

const OcrScreen = () => {
  const [imageUri, setImageUri] = useState(null);
  const [extractedData, setExtractedData] = useState({
    name: "",
    idNumber: "",
    dob: "",
  });
  const [confidence, setConfidence] = useState({
    name: null,
    idNumber: null,
    dob: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const handleCameraLaunch = async () => {
    const options: any = {
      mediaType: "photo",
      cameraType: "back",
      saveToPhotos: true,
      includeExtra: true,
      forceUpOrientation: true,
    };

    try {
      const result = await launchCamera(options);
      if (result.didCancel) {
        console.log("User cancelled camera picker");
      } else if (result.errorCode) {
        console.log("Error: " + result.errorMessage);
      } else {
        const assets = result?.assets;
        if (assets && assets.length > 0) {
          const uri: any = assets[0]?.uri;
          setImageUri(uri);
          processImageForOcr(uri);
        }
      }
    } catch (error) {
      console.log("Promise rejected:", error);
    }
  };

  const handleImagePicker = async () => {
    const options: any = {
      mediaType: "photo",
      quality: 1,
    };

    try {
      const result = await launchImageLibrary(options);

      if (result.didCancel) {
        console.log("User cancelled image picker");
        return;
      }

      if (result.errorCode) {
        console.log("ImagePicker Error: ", result.errorMessage);
        return;
      }

      const imageUri = result.assets?.[0]?.uri;

      // For now, using a mock image if no real image is picked
      const finalImage: any =
        imageUri ||
        "https://placehold.co/600x400/FFF/000?text=Mock%20ID%20Card";

      setImageUri(finalImage);
      processImageForOcr(finalImage);
    } catch (err) {
      console.error("Image Picker Error:", err);
    }
  };

  // Main function to process the image using OCR
  const processImageForOcr = async (uri) => {
    if (!uri) return;

    setIsProcessing(true);
    setSaveStatus("");
    setExtractedData({ name: "", idNumber: "", dob: "" });
    setConfidence({ name: null, idNumber: null, dob: null });

    try {
      const mockResultText =
        "Name: Jane Doe\nID Number: 1234567890\nDOB: 1990-05-15\n\nThis is a simulated ID card text. The text recognition is a mockup for demonstration purposes.";

      const result = await vision.recognize(uri);
      const text = result.blocks.map((block) => block.text).join("\n");

      console.log("OCR Result Text:", text);
      const parsedData = parseOcrData(text);
      console.log(parsedData, "Parsed Data");

      setTimeout(() => {
        setExtractedData(parsedData);
        setConfidence(parsedData.confidence);
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      console.error("OCR Error:", error);
      setSaveStatus("OCR failed. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field, value) => {
    setExtractedData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaveStatus("Saving...");

      await AsyncStorage.setItem("ocrUserData", JSON.stringify(extractedData));

      setTimeout(() => {
        setSaveStatus("Data successfully saved locally!");
        console.log("Data saved locally:", extractedData);
      }, 1000);
    } catch (error) {
      console.error("Save Error:", error);
      setSaveStatus("Failed to save data");
    }
  };
  console.log(saveStatus, "Save Status");
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>ID Card OCR</Text>
          <Text style={styles.subtitle}>
            Capture or upload an ID to extract details.
          </Text>
        </View>

        {/* Image Preview and Capture Buttons */}
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>
                No ID card image selected
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleCameraLaunch}
              disabled={isProcessing}
            >
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={handleImagePicker}
              disabled={isProcessing}
            >
              <Text style={styles.buttonText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Extracted Data and Editable Fields */}
        <View style={styles.dataContainer}>
          {isProcessing ? (
            <ActivityIndicator size="large" color="#007bff" />
          ) : (
            <View>
              {extractedData.name ||
              extractedData.idNumber ||
              extractedData.dob ? (
                <>
                  <Text style={styles.sectionTitle}>Extracted Information</Text>

                  {["name", "idNumber", "dob"].map((field) => (
                    <View key={field} style={styles.inputGroup}>
                      <Text style={styles.label}>
                        {field
                          .replace(/([A-Z])/g, " $1")
                          .trim()
                          .toUpperCase()}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={extractedData[field]}
                        onChangeText={(value) =>
                          handleInputChange(field, value)
                        }
                      />
                      {confidence[field] && (
                        <Text style={styles.confidenceText}>
                          Confidence: {Math.round(confidence[field] * 100)}%
                        </Text>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={isProcessing}
                  >
                    <Text style={styles.saveButtonText}>Save Data</Text>
                  </TouchableOpacity>

                  {saveStatus && (
                    <Text
                      style={[
                        styles.statusText,
                        saveStatus.includes("successfully")
                          ? styles.statusSuccess
                          : styles.statusError,
                      ]}
                    >
                      {saveStatus}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.infoText}>
                  Captured data will appear here after processing.
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 5,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 20,
  },
  imagePreview: {
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: 8,
    marginBottom: 15,
  },
  imagePlaceholder: {
    width: "100%",
    aspectRatio: 1.6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eee",
    borderRadius: 8,
    marginBottom: 15,
  },
  placeholderText: {
    color: "#888",
    fontSize: 16,
    fontStyle: "italic",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  button: {
    backgroundColor: "#007bff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    flex: 1,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  dataContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 5,
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  confidenceText: {
    fontSize: 12,
    color: "#008000",
    marginTop: 5,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#28a745",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  statusText: {
    marginTop: 10,
    textAlign: "center",
    fontWeight: "bold",
  },
  statusSuccess: {
    color: "#28a745",
  },
  statusError: {
    color: "#dc3545",
  },
  infoText: {
    fontStyle: "italic",
    color: "#777",
    textAlign: "center",
  },
});

export default OcrScreen;
