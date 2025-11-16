import { useState } from 'react';
import type { 
  ImportFormatDefinition, 
  FieldMapping, 
  CSVSettings,
  DetectionPattern 
} from '../../../types';
import Step1FileAnalysis from './Step1FileAnalysis';
import Step2FieldMapping from './Step2FieldMapping';
import Step3Preview from './Step3Preview';
import Step4SaveFormat from './Step4SaveFormat';

interface FormatWizardProps {
  file: File;
  onComplete: (format: ImportFormatDefinition) => void;
  onCancel: () => void;
  existingFormat?: ImportFormatDefinition; // For editing
}

export interface WizardState {
  csvSettings: CSVSettings;
  fieldMappings: FieldMapping[];
  detectionPattern?: DetectionPattern;
  parsedPreview: {
    headers: string[];
    rows: string[][];
  };
}

export default function FormatWizardMain({ 
  file, 
  onComplete, 
  onCancel,
  existingFormat 
}: Readonly<FormatWizardProps>) {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>({
    csvSettings: existingFormat?.csvSettings || {
      delimiter: ';',
      hasHeader: true,
      encoding: 'utf-8',
      skipEmptyLines: true,
      skipRows: 0,
    },
    fieldMappings: existingFormat?.fieldMappings || [],
    detectionPattern: existingFormat?.detectionPattern,
    parsedPreview: {
      headers: [],
      rows: [],
    },
  });

  const updateWizardState = (updates: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleStepComplete = (stepData: Partial<WizardState>) => {
    updateWizardState(stepData);
    handleNext();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {existingFormat ? 'Edit Import Format' : 'Create Import Format'}
          </h2>
          
          {/* Progress Steps */}
          <div className="mt-4 flex items-center justify-between">
            {[
              { num: 1, label: 'File Analysis' },
              { num: 2, label: 'Field Mapping' },
              { num: 3, label: 'Preview' },
              { num: 4, label: 'Save Format' },
            ].map((step, idx) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      currentStep > step.num
                        ? 'bg-green-500 text-white'
                        : currentStep === step.num
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {currentStep > step.num ? '✓' : step.num}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      currentStep === step.num ? 'text-blue-600' : 'text-gray-600'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      currentStep > step.num ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 1 && (
            <Step1FileAnalysis
              file={file}
              initialSettings={wizardState.csvSettings}
              onComplete={handleStepComplete}
              onCancel={onCancel}
            />
          )}
          {currentStep === 2 && (
            <Step2FieldMapping
              csvSettings={wizardState.csvSettings}
              parsedPreview={wizardState.parsedPreview}
              initialMappings={wizardState.fieldMappings}
              onComplete={handleStepComplete}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && (
            <Step3Preview
              file={file}
              csvSettings={wizardState.csvSettings}
              fieldMappings={wizardState.fieldMappings}
              onComplete={handleStepComplete}
              onBack={handleBack}
            />
          )}
          {currentStep === 4 && (
            <Step4SaveFormat
              file={file}
              csvSettings={wizardState.csvSettings}
              fieldMappings={wizardState.fieldMappings}
              detectionPattern={wizardState.detectionPattern}
              existingFormat={existingFormat}
              onComplete={onComplete}
              onBack={handleBack}
              onCancel={onCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
