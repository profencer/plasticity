<%_ if (arg.rawType == "double") { _%>
    <%- arg.const %> double <%- arg.name %> = info[<%- arg.jsIndex %>].ToNumber().DoubleValue();
<%_ } else if (arg.isNumber) { _%>
    <%- arg.const %> int <%- arg.name %> = info[<%- arg.jsIndex %>].ToNumber().Int64Value();
<%_ } else if (arg.rawType == "bool") { _%>
    <%- arg.const %> bool <%- arg.name %> = info[<%- arg.jsIndex %>].ToBoolean();
<%_ } else if (arg.jsType == "Array") { _%>
    const Napi::Array <%- arg.name %>_ = Napi::Array(env, info[<%- arg.jsIndex %>]);
    <%- arg.rawType %> <%- (_return == 'promise' || arg.ref == '*') ? '*' : '' %> <%- arg.name %> = <%- (_return == 'promise' || arg.ref == '*') ? 'new' : '' %> <%- arg.rawType %>(<%- arg.name %>_.Length(), 1);
    for (size_t i = 0; i < <%- arg.name %>_.Length(); i++) {
        if (<%- arg.name %>_[i].IsNull() || <%- arg.name %>_[i].IsUndefined()) {
            std::cerr << __FILE__ << ":" << __LINE__ << " warning: Passed an array with a null element at [" << i << "]. This is probably a mistake, so skipping\n";
        } else if (!<%- arg.name %>_[i].IsObject() || !<%- arg.name %>_[i].ToObject().InstanceOf(<%- arg.elementType.cppType %>::GetConstructor(env))) {
            <%_ if (_return == 'value') { _%>
                Napi::Error::New(env, "<%-arg.elementType.jsType%> <%-arg.name%> is required.").ThrowAsJavaScriptException();
                return env.Undefined();
            <%_ } else if (_return == 'promise') { _%>
                deferred.Reject(Napi::String::New(env, "<%-arg.elementType.jsType%> <%-arg.name%> is required."));
                return deferred.Promise();
            <%_ } else { _%>
                Napi::Error::New(env, "<%-arg.elementType.jsType%> <%-arg.name%> is required.").ThrowAsJavaScriptException();
                return;
            <%_ } _%>
        } else {
            <%- arg.name %><%- (_return == 'promise' || arg.ref == '*') ? '->' : '.' %>Add(<%_ if (!arg.elementType.isReference) { _%>*<%_ } _%><%- arg.elementType.cppType %>::Unwrap(<%- arg.name %>_[i].ToObject())->_underlying);
        }
    }
<%_ } else if (arg.isCppString2CString) { _%>
    const std::string <%- arg.name %> = info[<%- arg.jsIndex %>].ToString().Utf8Value();
<%_ } else if (arg.isEnum) { _%>
    const <%- arg.rawType %> <%- arg.name %> = static_cast<<%- arg.rawType %>>(info[<%- arg.jsIndex %>].ToNumber().Uint32Value());
<%_ } else { _%>
    <%_ if (arg.isOptional || arg.isNullable) { _%>
        <%- arg.rawType %> <%- arg.ref %> <%- arg.name %> = NULL;
        if (!(info[<%- arg.jsIndex %>].IsNull() || info[<%- arg.jsIndex %>].IsUndefined())) {
            <%- arg.cppType %> *<%- arg.name %>_ = <%- arg.cppType %>::Unwrap(info[<%- arg.jsIndex %>].ToObject());
                <%- arg.name %> = <%- arg.name %>_ <%_ if (!arg.isRaw) { _%> ->_underlying <%_ }  _%>;
        } else {
            <%- arg.name %> = NULL;
        }
    <%_ } else { _%>
        if (info[<%- arg.jsIndex %>].IsNull() || info[<%- arg.jsIndex %>].IsUndefined()) {
            <%_ if (_return == 'value') { _%>
                Napi::Error::New(env, "Passed null for non-optional parameter '<%- arg.name %>'").ThrowAsJavaScriptException();
                return env.Undefined();
            <%_ } else if (_return == 'promise') { _%>
                deferred.Reject(Napi::String::New(env, "Passed null for non-optional parameter '<%- arg.name %>'"));
                return deferred.Promise();
            <%_ } else { _%>
                Napi::Error::New(env, "Passed null for non-optional parameter '<%- arg.name %>'").ThrowAsJavaScriptException();
                return;
            <%_ } _%>
        }
        const <%- arg.cppType %> *<%- arg.name %>_ = <%- arg.cppType %>::Unwrap(info[<%- arg.jsIndex %>].ToObject());
        
        <%- arg.rawType %> <%- arg.ref %> <%- arg.name %> = <%_ if (!arg.isPointer) { _%>*<%_ } _%><%- arg.name %>_->_underlying;
        
    <%_ } _%>
<%_ } _%>