import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Send, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type { Plan } from '../types/plan';

interface PlanReviewFormProps {
  plan: Plan;
  onSubmit: (data: { status: 'APPROVED' | 'REJECTED'; feedback: string }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const PlanReviewForm: React.FC<PlanReviewFormProps> = ({
  plan,
  onSubmit,
  onCancel,
  isSubmitting = false
}) => {
  const [error, setError] = useState<string | null>(null);
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      status: 'APPROVED',
      feedback: ''
    }
  });

  const status = watch('status');

  const handleFormSubmit = async (data: any) => {
    try {
      setError(null);
      await onSubmit(data);
    } catch (error: any) {
      setError(error.message || 'Failed to submit review');
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Review Decision
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="relative flex items-center p-4 border rounded-lg cursor-pointer">
            <input
              type="radio"
              value="APPROVED"
              {...register('status')}
              className="sr-only"
            />
            <div className={`flex items-center ${status === 'APPROVED' ? 'text-green-600' : 'text-gray-500'}`}>
              <CheckCircle className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">Approve</p>
                <p className="text-sm">Accept the plan as is</p>
              </div>
            </div>
            {status === 'APPROVED' && (
              <div className="absolute inset-0 border-2 border-green-500 rounded-lg pointer-events-none" />
            )}
          </label>

          <label className="relative flex items-center p-4 border rounded-lg cursor-pointer">
            <input
              type="radio"
              value="REJECTED"
              {...register('status')}
              className="sr-only"
            />
            <div className={`flex items-center ${status === 'REJECTED' ? 'text-red-600' : 'text-gray-500'}`}>
              <XCircle className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">Reject</p>
                <p className="text-sm">Request changes</p>
              </div>
            </div>
            {status === 'REJECTED' && (
              <div className="absolute inset-0 border-2 border-red-500 rounded-lg pointer-events-none" />
            )}
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Feedback
        </label>
        <textarea
          {...register('feedback', {
            required: status === 'REJECTED' ? 'Feedback is required when rejecting a plan' : false,
            minLength: {
              value: 10,
              message: 'Feedback must be at least 10 characters'
            }
          })}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter your feedback..."
        />
        {errors.feedback && (
          <p className="mt-1 text-sm text-red-600">{errors.feedback.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Send className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Review
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default PlanReviewForm;