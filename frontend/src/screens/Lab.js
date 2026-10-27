import React, { useState } from 'react';

import {
  Alert,
  Image,
  ScrollView,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { api } from '../api';

import {
  Async,
  Badge,
  Btn,
  Card,
  Chips,
  Empty,
  Field,
  Header,
  Row,
  Sheet,
  Stack,
  T,
  run,
  statusTone,
  useLoad,
} from '../ui';

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const REPORT_TYPES = [
  { value: 'text', label: 'General' },
  { value: 'blood_test', label: 'Blood Test' },
  { value: 'xray', label: 'X-Ray' },
  { value: 'ct', label: 'CT Scan' },
  { value: 'mri', label: 'MRI' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'other', label: 'Other' },
];

const styles = {
  section: {
    padding: 12,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: '#F3F7FC',
  },

  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#17365D',
    marginBottom: 10,
  },

  text: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 6,
    lineHeight: 21,
  },

  image: {
    width: '100%',
    height: 220,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },

  fileCard: {
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },

  hint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 5,
    marginBottom: 8,
  },
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function parseMeasurements(value) {
  const parsed = JSON.parse(value || '{}');

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'Measurements must be a JSON object.'
    );
  }

  return parsed;
}

function formatMeasurements(value) {
  if (!value) {
    return '{}';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

// --------------------------------------------------
// Report Preview
// --------------------------------------------------

function ReportPreview({ report }) {
  if (!report) {
    return null;
  }

  const images = Array.isArray(report.images)
    ? report.images
    : [];

  const measurements = report.measurements || {};

  return (
    <ScrollView
      style={{ maxHeight: 650 }}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      {/* Patient information */}

      <View style={styles.section}>
        <Text style={styles.heading}>
          Patient Information
        </Text>

        <Text style={styles.text}>
          Patient: {report.patient_name || 'Not available'}
        </Text>

        <Text style={styles.text}>
          UHID: {report.uhid || 'Not available'}
        </Text>

        <Text style={styles.text}>
          Test: {report.test || 'Not available'}
        </Text>

        <Text style={styles.text}>
          Order ID: {report.id}
        </Text>

        <Text style={styles.text}>
          Report Type: {report.report_type || 'text'}
        </Text>

        <Text style={styles.text}>
          Status: {report.status || 'Unknown'}
        </Text>
      </View>

      {/* X-ray / CT / MRI images */}

      {images.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading}>
            Medical Images ({images.length})
          </Text>

          {images.map((uri, index) => (
            <View
              key={`${uri}-${index}`}
              style={styles.fileCard}
            >
              <Text style={styles.text}>
                Image {index + 1}
              </Text>

              <Image
                source={{ uri }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          ))}
        </View>
      )}

      {/* Findings */}

      <View style={styles.section}>
        <Text style={styles.heading}>
          Findings
        </Text>

        <Text style={styles.text}>
          {report.findings || report.result || 'No findings entered.'}
        </Text>
      </View>

      {/* Impression */}

      <View style={styles.section}>
        <Text style={styles.heading}>
          Impression / Conclusion
        </Text>

        <Text style={styles.text}>
          {report.impression || 'No impression entered.'}
        </Text>
      </View>

      {/* General result */}

      <View style={styles.section}>
        <Text style={styles.heading}>
          Result
        </Text>

        <Text style={styles.text}>
          {report.result || 'Result pending.'}
        </Text>
      </View>

      {/* Blood test measurements */}

      {Object.keys(measurements).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading}>
            Laboratory Measurements
          </Text>

          {Object.entries(measurements).map(
            ([name, value]) => (
              <View
                key={name}
                style={{
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#DCE5EF',
                }}
              >
                <Text style={styles.text}>
                  {name.replaceAll('_', ' ').toUpperCase()}
                </Text>

                <Text style={styles.text}>
                  {typeof value === 'object' && value !== null
                    ? JSON.stringify(value)
                    : String(value)}
                </Text>
              </View>
            )
          )}
        </View>
      )}

      {/* AI draft */}

      {!!report.ai_summary && (
        <View style={styles.section}>
          <Text style={styles.heading}>
            AI-Assisted Summary
          </Text>

          <Text style={styles.text}>
            {report.ai_summary}
          </Text>

          <Text style={styles.hint}>
            AI-generated draft. It must be reviewed by
            an authorized healthcare professional.
          </Text>
        </View>
      )}

      {/* PDF link */}

      {!!report.report_url && (
        <View style={styles.section}>
          <Text style={styles.heading}>
            PDF Report
          </Text>

          <Text style={styles.text}>
            {report.report_url}
          </Text>

          <Text style={styles.hint}>
            Open this file using an authorized PDF viewer.
            The URL is displayed here; a PDF-opening action
            must be configured separately.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// --------------------------------------------------
// Main Lab Page
// --------------------------------------------------

export default function Lab({ me }) {
  const [st, setSt] = useState('ordered');

  const [sel, setSel] = useState(null);
  const [preview, setPreview] = useState(null);

  const [res, setRes] = useState('');
  const [reportType, setReportType] = useState('text');

  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');

  const [reportUrl, setReportUrl] = useState('');
  const [imageUrls, setImageUrls] = useState('');

  const [measurements, setMeasurements] = useState('{}');
  const [aiSummary, setAiSummary] = useState('');

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');

  const canManage = ['admin', 'lab'].includes(me?.role);

  // Load orders from FastAPI.

  const s = useLoad(
    () => api('/lab/orders?status=' + st),
    [st]
  );

  // Reset the result form.

  function resetForm() {
    setSel(null);

    setRes('');
    setReportType('text');

    setFindings('');
    setImpression('');

    setReportUrl('');
    setImageUrls('');

    setMeasurements('{}');
    setAiSummary('');

    setSelectedFiles([]);
    setError('');
  }

  // Open a waiting order.

  function openResult(order) {
    setSel(order);

    setRes(order.result || '');
    setReportType(order.report_type || 'text');

    setFindings(order.findings || '');
    setImpression(order.impression || '');

    setReportUrl(order.report_url || '');

    setImageUrls(
      Array.isArray(order.images)
        ? order.images.join('\n')
        : ''
    );

    setMeasurements(
      formatMeasurements(order.measurements)
    );

    setAiSummary(order.ai_summary || '');

    setSelectedFiles([]);
    setError('');
  }

  // Choose X-ray / CT / MRI / other images.

  async function chooseImages() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const files = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name:
          asset.fileName ||
          `lab-image-${Date.now()}-${index}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        type: 'image',
      }));

      setSelectedFiles((previous) => [
        ...previous,
        ...files,
      ]);
    } catch (e) {
      Alert.alert(
        'Image selection failed',
        e?.message || 'Unable to select images.'
      );
    }
  }

  // Choose a PDF report from the device.

  async function choosePDF() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const files = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/pdf',
        type: 'pdf',
      }));

      setSelectedFiles((previous) => [
        ...previous,
        ...files,
      ]);
    } catch (e) {
      Alert.alert(
        'Document selection failed',
        e?.message || 'Unable to select the PDF.'
      );
    }
  }

  // Remove a selected file before uploading.

  function removeFile(index) {
    setSelectedFiles((previous) =>
      previous.filter((_, i) => i !== index)
    );
  }

  // Upload selected files to FastAPI.

  async function uploadFiles() {
    if (selectedFiles.length === 0) {
      Alert.alert(
        'No files selected',
        'Choose images or a PDF first.'
      );
      return;
    }

    if (uploading) {
      return;
    }

    setUploading(true);
    setError('');

    try {
      const uploaded = [];

      for (const file of selectedFiles) {
        const formData = new FormData();

        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        });

        const response = await api('/lab/upload', {
          method: 'POST',
          body: formData,
        });

        uploaded.push(response);
      }

      const newImages = uploaded
        .filter((file) =>
          file.content_type?.startsWith('image/')
        )
        .map((file) => file.url);

      const pdfs = uploaded.filter(
        (file) => file.content_type === 'application/pdf'
      );

      // Automatically populate image URLs.

      if (newImages.length > 0) {
        setImageUrls((previous) => {
          const existing = previous
            .split(/\r?\n/)
            .map((url) => url.trim())
            .filter(Boolean);

          return [...existing, ...newImages].join('\n');
        });
      }

      // Use the latest selected PDF as the report URL.

      if (pdfs.length > 0) {
        setReportUrl(pdfs[pdfs.length - 1].url);
      }

      setSelectedFiles([]);

      Alert.alert(
        'Upload successful',
        `${uploaded.length} file(s) uploaded. Click Save Result to attach them to the report.`
      );
    } catch (e) {
      setError(
        e?.message || 'File upload failed.'
      );
    } finally {
      setUploading(false);
    }
  }

  // Save the report through the existing backend endpoint.

  async function saveResult() {
    if (!sel || saving) {
      return;
    }

    if (!res.trim()) {
      setError('Please enter the result.');
      return;
    }

    let parsedMeasurements;

    try {
      parsedMeasurements = parseMeasurements(measurements);
    } catch {
      setError(
        'Measurements must contain valid JSON, such as {"hemoglobin":{"value":13.5,"unit":"g/dL"}}.'
      );
      return;
    }

    const payload = {
      result: res.trim(),

      report_url: reportUrl.trim() || null,

      report_type: reportType,

      findings: findings.trim() || null,

      impression: impression.trim() || null,

      images: imageUrls
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean),

      measurements: parsedMeasurements,

      ai_summary: aiSummary.trim() || null,
    };

    setSaving(true);
    setError('');

    try {
      await api(`/lab/orders/${sel.id}/result`, {
        method: 'POST',
        body: payload,
      });

      resetForm();

      await s.reload();

      Alert.alert(
        'Success',
        'Laboratory report saved successfully.'
      );
    } catch (e) {
      setError(
        e?.message || 'Unable to save the report.'
      );
    } finally {
      setSaving(false);
    }
  }

  // Open a complete report.

  async function openReport(order) {
    setError('');

    try {
      const report = await api(`/lab/orders/${order.id}`);

      setPreview(report);
    } catch (e) {
      setError(
        e?.message || 'Unable to load the report.'
      );
    }
  }

  // --------------------------------------------------
  // Page UI
  // --------------------------------------------------

  return (
    <Stack>
      <Header title="Laboratory Dashboard" />

      <Chips
        options={[
          {
            value: 'ordered',
            label: 'Waiting',
          },
          {
            value: 'done',
            label: 'Completed',
          },
        ]}
        value={st}
        onChange={setSt}
      />

      {/* Orders list */}

      <Card>
        <Async s={s}>
          {(list) =>
            list.length === 0 ? (
              <Empty text="No laboratory orders found." />
            ) : (
              list.map((order) => (
                <Row
                  key={order.id}
                  left={
                    <View style={{ flex: 1, paddingVertical: 6 }}>
                      <T v="b">
                        {order.test} · {order.patient_name}
                      </T>

                      <T v="small">
                        UHID: {order.uhid}
                      </T>

                      <T v="small">
                        {order.report_type || 'text'}
                      </T>

                      <T v="small">
                        {order.result || 'Result pending'}
                      </T>
                    </View>
                  }
                  right={
                    <View
                      style={{
                        alignItems: 'flex-end',
                        gap: 8,
                      }}
                    >
                      <Badge
                        text={order.status}
                        tone={statusTone(order.status)}
                      />

                      <Btn
                        small
                        title="View Report"
                        onPress={() => openReport(order)}
                      />

                      {canManage &&
                        order.status === 'ordered' && (
                          <Btn
                            small
                            title="Enter Result"
                            onPress={() => openResult(order)}
                          />
                        )}
                    </View>
                  }
                />
              ))
            )
          }
        </Async>
      </Card>

      {/* Result-entry form */}

      <Sheet
        visible={!!sel}
        onClose={resetForm}
        title={
          sel
            ? `${sel.test} · ${sel.patient_name}`
            : 'Enter Lab Result'
        }
      >
        <ScrollView
          style={{ maxHeight: 650 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <Stack>
            <View style={styles.section}>
              <Text style={styles.heading}>
                Patient Details
              </Text>

              <Text style={styles.text}>
                Patient: {sel?.patient_name || ''}
              </Text>

              <Text style={styles.text}>
                UHID: {sel?.uhid || ''}
              </Text>

              <Text style={styles.text}>
                Order ID: {sel?.id || ''}
              </Text>
            </View>

            {/* Test category */}

            <T v="b">Report Type</T>

            <Chips
              options={REPORT_TYPES}
              value={reportType}
              onChange={setReportType}
            />

            {/* Results */}

            <Field
              label="Result"
              value={res}
              onChangeText={setRes}
              multiline
            />

            <Field
              label="Detailed Findings"
              value={findings}
              onChangeText={setFindings}
              multiline
            />

            <Field
              label="Impression / Conclusion"
              value={impression}
              onChangeText={setImpression}
              multiline
            />

            {/* Upload controls */}

            <View style={styles.section}>
              <Text style={styles.heading}>
                Images and Documents
              </Text>

              <Text style={styles.text}>
                Select X-ray, CT scan, MRI images or PDF reports
                from your device.
              </Text>

              <Btn
                title="Choose Images"
                onPress={chooseImages}
              />

              <Btn
                title="Choose PDF Report"
                onPress={choosePDF}
              />

              {/* Selected files preview */}

              {selectedFiles.map((file, index) => (
                <View
                  key={`${file.uri}-${index}`}
                  style={styles.fileCard}
                >
                  {file.type === 'image' ? (
                    <Image
                      source={{ uri: file.uri }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.text}>
                      PDF: {file.name}
                    </Text>
                  )}

                  <Text style={styles.hint}>
                    {file.name}
                  </Text>

                  <Btn
                    small
                    title="Remove"
                    onPress={() => removeFile(index)}
                  />
                </View>
              ))}

              {selectedFiles.length > 0 && (
                <Btn
                  title={
                    uploading
                      ? 'Uploading...'
                      : `Upload ${selectedFiles.length} File(s)`
                  }
                  onPress={uploadFiles}
                />
              )}

              <Text style={styles.hint}>
                Upload files before saving the report.
              </Text>
            </View>

            {/* Uploaded image URLs */}

            <Field
              label="Image URLs (one per line)"
              value={imageUrls}
              onChangeText={setImageUrls}
              multiline
            />

            <Field
              label="PDF Report URL"
              value={reportUrl}
              onChangeText={setReportUrl}
            />

            {/* Measurements */}

            <Field
              label="Measurements JSON"
              value={measurements}
              onChangeText={setMeasurements}
              multiline
            />

            {/* AI draft */}

            <Field
              label="AI Summary Draft (Optional)"
              value={aiSummary}
              onChangeText={setAiSummary}
              multiline
            />

            {!!error && (
              <Text
                style={{
                  color: '#B91C1C',
                  marginVertical: 10,
                }}
              >
                {error}
              </Text>
            )}

            <Btn
              title={
                saving
                  ? 'Saving...'
                  : 'Save Result'
              }
              onPress={saveResult}
            />

            <Btn
              title="Cancel"
              onPress={resetForm}
            />
          </Stack>
        </ScrollView>
      </Sheet>

      {/* Report preview */}

      <Sheet
        visible={!!preview}
        onClose={() => setPreview(null)}
        title={
          preview
            ? `${preview.test} · Report`
            : 'Lab Report'
        }
      >
        <ReportPreview report={preview} />
      </Sheet>
    </Stack>
  );
}