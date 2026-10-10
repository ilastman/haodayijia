const copy = require('../../utils/copy');
const { isValidPhone, addConsultRecord } = require('../../utils/util');

Component({
  properties: {
    visible: { type: Boolean, value: false },
    routeId: { type: String, value: '' },
    routeTitle: { type: String, value: '' }
  },

  data: {
    title: copy.modal.title,
    labels: {
      name: copy.modal.name,
      phone: copy.modal.phone,
      people: copy.modal.people,
      date: copy.modal.date,
      remark: copy.modal.remark,
      required: copy.modal.required,
      submit: copy.modal.submit,
      close: copy.modal.close
    },
    ph: {
      name: copy.modal.namePlaceholder,
      phone: copy.modal.phonePlaceholder,
      people: copy.modal.peoplePlaceholder,
      remark: copy.modal.remarkPlaceholder
    },
    form: { name: '', phone: '', people: '', date: '', remark: '' },
    error: '',
    minDate: ''
  },

  lifetimes: {
    attached() {
      const d = new Date();
      const pad = n => (n < 10 ? '0' + n : '' + n);
      this.setData({ minDate: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) });
    }
  },

  methods: {
    noop() {},
    close() {
      this.triggerEvent('close');
    },

    onInput(e) {
      const k = e.currentTarget.dataset.k;
      this.setData({ ['form.' + k]: e.detail.value, error: '' });
    },

    onDateChange(e) {
      this.setData({ 'form.date': e.detail.value, error: '' });
    },

    submit() {
      const { form } = this.data;
      if (!form.name.trim()) {
        this.setData({ error: copy.modal.nameError });
        return;
      }
      if (!isValidPhone(form.phone)) {
        this.setData({ error: copy.modal.phoneError });
        return;
      }

      addConsultRecord({
        name: form.name.trim(),
        phone: form.phone.trim(),
        people: form.people.trim() || '未填写',
        date: form.date || '待定',
        remark: form.remark.trim(),
        routeId: this.data.routeId,
        routeTitle: this.data.routeTitle
      });

      this.setData({
        form: { name: '', phone: '', people: '', date: '', remark: '' },
        error: ''
      });

      wx.showToast({ title: copy.modal.success, icon: 'none', duration: 2500 });
      this.triggerEvent('success');
      this.triggerEvent('close');
    }
  }
});
