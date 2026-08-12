/**
 * buildDefaultInput — builds a minimal sample object from a JSON Schema.
 * Used by both TestSkillPanel and SkillDetail's quick-execute button.
 *
 * Fills required fields with their zero value by type.
 * Non-required fields are omitted.
 */
export const buildDefaultInput = (schema) => {
  if (!schema || typeof schema !== 'object') return {};
  const result = {};
  const props = schema.properties || {};
  const required = schema.required || [];
  for (const key of required) {
    const prop = props[key] || {};
    if (prop.type === 'string') result[key] = '';
    else if (prop.type === 'number' || prop.type === 'integer') result[key] = 0;
    else if (prop.type === 'boolean') result[key] = false;
    else if (prop.type === 'array') result[key] = [];
    else if (prop.type === 'object') result[key] = {};
    else result[key] = null;
  }
  return result;
};
