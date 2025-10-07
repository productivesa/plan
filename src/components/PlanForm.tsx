import React from 'react';
import { useForm } from 'react-hook-form';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { Plan, PlanType } from '../types/plan';
import type { StrategicObjective, Program, SubProgram } from '../types/organization';

interface PlanFormProps {
  onSubmit: (data: Partial<Plan>) => void;
  objectives: StrategicObjective[];
  programs: Program[];
  subprograms: SubProgram[];
  initialData?: Partial<Plan>;
}

const PlanForm: React.FC<PlanFormProps> = ({
  onSubmit,
  objectives,
  programs,
  subprograms,
  initialData,
}) => {
  const { t } = useLanguage();
  const { register, handleSubmit, watch } = useForm<Partial<Plan>>({
    defaultValues: initialData,
  });

  const planType = watch('type');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('planning.type')}
        </label>
        <select
          {...register('type')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="LEAD_EXECUTIVE">{t('planning.types.leadExecutive')}</option>
          <option value="TEAM_DESK">{t('planning.types.teamDesk')}</option>
          <option value="INDIVIDUAL">{t('planning.types.individual')}</option>
        </select>
      </div>

      {planType === 'LEAD_EXECUTIVE' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('planning.executiveName')}
          </label>
          <input
            type="text"
            {...register('executiveName')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('planning.fiscalYear')}
        </label>
        <input
          type="text"
          {...register('fiscalYear')}
          placeholder="YYYY"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('planning.strategicObjective')}
        </label>
        <select
          {...register('strategicObjectiveId')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">{t('planning.select')}</option>
          {objectives.map((objective) => (
            <option key={objective.id} value={objective.id}>
              {objective.title} ({objective.weight}%)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('planning.program')}
        </label>
        <select
          {...register('programId')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">{t('planning.select')}</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name} ({program.weight}%)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('planning.subprogram')}
        </label>
        <select
          {...register('subprogramId')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">{t('planning.select')}</option>
          {subprograms.map((subprogram) => (
            <option key={subprogram.id} value={subprogram.id}>
              {subprogram.name} ({subprogram.weight}%)
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        {t('common.save')}
      </button>
    </form>
  );
};

export default PlanForm